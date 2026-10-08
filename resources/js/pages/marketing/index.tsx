import { MarketingBar } from '@/components/marketing/marketing-bar';
import { choiceClass, Sheet, Toast } from '@/components/till/sheet';
import { useLiveReload } from '@/hooks/use-live-reload';
import { useToast } from '@/hooks/use-toast';
import { type MarketingBranch, type MarketingOrderView } from '@/lib/marketing';
import { firstError } from '@/lib/till';
import { cn } from '@/lib/utils';
import { Head, router, usePoll } from '@inertiajs/react';
import { useState } from 'react';

interface MarketingProps {
    branches: MarketingBranch[];
    sent: MarketingOrderView[];
}

interface CartLine {
    key: string;
    menuItemId: number;
    name: string;
    category: string;
    qty: number;
    addons: { id: number; name: string }[];
}

type Service = 'pickup' | 'delivery';
type MarketingItem = MarketingBranch['items'][number];

const todayIso = () => {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const categoryLabel = (name: string) => (name === 'Frappe' ? 'Frappé' : name);

const niceWhen = (date: string, time: string) => {
    const day = date ? new Date(`${date}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '';
    const clock = time ? new Date(`2000-01-01T${time}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '';

    return [day, clock].filter(Boolean).join(' · ');
};

/**
 * Marketing takes bulk and event orders off-site and sends them to the branch that will make them. The
 * menu here has no prices; the till applies them when the branch accepts the order.
 */
export default function Marketing({ branches, sent }: MarketingProps) {
    const [tab, setTab] = useState<'order' | 'sent'>(() => (new URLSearchParams(window.location.search).get('tab') === 'sent' ? 'sent' : 'order'));
    const [branchId, setBranchId] = useState(branches[0]?.id);
    const [categoryId, setCategoryId] = useState<number | null>(branches[0]?.categories[0]?.id ?? null);
    const [search, setSearch] = useState('');
    const [service, setService] = useState<Service>('pickup');
    const [customer, setCustomer] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [wantedOn, setWantedOn] = useState(todayIso);
    const [wantedAt, setWantedAt] = useState('10:00');
    const [note, setNote] = useState('');
    const [cart, setCart] = useState<CartLine[]>([]);
    const [picking, setPicking] = useState<{ item: MarketingItem; addonIds: number[]; qty: number } | null>(null);
    const [info, setInfo] = useState<MarketingItem | null>(null);
    const [sending, setSending] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [filter, setFilter] = useState<'All' | 'Waiting' | 'Accepted' | 'Declined'>('All');
    const [toast, showToast] = useToast();

    useLiveReload('marketing', {
        MarketingOrderUpdated: ['sent'],
        MenuAvailabilityChanged: ['branches'],
    });

    // A fallback for when live updates aren't reaching this page.
    usePoll(60000, { only: ['sent'] });

    const branch = branches.find((candidate) => candidate.id === branchId) ?? branches[0];
    const categoryName = (id: number) => branch.categories.find((category) => category.id === id)?.name ?? '';
    const terms = search.trim().toLowerCase();
    const items = branch.items.filter((item) =>
        terms ? `${item.name} ${item.note ?? ''}`.toLowerCase().includes(terms) : item.category_id === categoryId,
    );
    const count = cart.reduce((sum, line) => sum + line.qty, 0);
    const countLabel = `${count} ${count === 1 ? 'item' : 'items'}`;
    const when = niceWhen(wantedOn, wantedAt);

    const add = (item: MarketingItem, addonIds: number[], qty: number) => {
        const addons = branch.addons.filter((addon) => addonIds.includes(addon.id));
        const key = `${item.id}|${[...addonIds].sort((a, b) => a - b).join(',')}`;

        setCart((current) =>
            current.some((line) => line.key === key)
                ? current.map((line) => (line.key === key ? { ...line, qty: line.qty + qty } : line))
                : [...current, { key, menuItemId: item.id, name: item.name, category: categoryName(item.category_id), qty, addons }],
        );
        setPicking(null);
    };

    const setQty = (key: string, qty: number) =>
        setCart((current) => current.map((line) => (line.key === key ? { ...line, qty } : line)).filter((line) => line.qty > 0));

    const pickBranch = (next: MarketingBranch) => {
        const kept = cart.filter((line) => next.items.some((item) => item.id === line.menuItemId));
        const dropped = cart.filter((line) => !kept.includes(line));

        setBranchId(next.id);
        setCategoryId(next.categories[0]?.id ?? null);
        setCart(kept);

        if (dropped.length) {
            showToast(`${next.name} does not make ${dropped.map((line) => line.name).join(', ')}`);
        }
    };

    const clear = () => {
        setCart([]);
        setNote('');
        setCustomer('');
        setPhone('');
        setAddress('');
    };

    const openSend = () => {
        if (!customer.trim()) {
            showToast('Add the customer name');
        } else if (!cart.length) {
            showToast('Add at least one item');
        } else {
            setSending(true);
        }
    };

    const send = () =>
        router.post(
            route('marketing.orders.store'),
            {
                branch_id: branch.id,
                service,
                customer,
                phone,
                address,
                wanted_on: wantedOn,
                wanted_at: wantedAt || null,
                note,
                lines: cart.map((line) => ({ menu_item_id: line.menuItemId, qty: line.qty, addon_ids: line.addons.map((addon) => addon.id) })),
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => {
                    setSending(false);
                    clear();
                    showToast(`Order sent to ${branch.name}`);
                },
                onError: (errors) => {
                    setSending(false);
                    showToast(firstError(errors));
                },
            },
        );

    const copyToNew = (order: MarketingOrderView) => {
        const target = branches.find((candidate) => candidate.id === order.branch_id) ?? branch;

        setBranchId(target.id);
        setCategoryId(target.categories[0]?.id ?? null);
        setService(order.service);
        setCustomer(order.customer);
        setPhone(order.phone ?? '');
        setAddress(order.address ?? '');
        setNote(order.note ?? '');
        setCart(
            order.lines
                .filter((line) => target.items.some((item) => item.id === line.menu_item_id))
                .map((line) => {
                    const item = target.items.find((candidate) => candidate.id === line.menu_item_id)!;

                    return {
                        key: `${item.id}|${line.addons
                            .map((addon) => addon.id)
                            .sort((a, b) => a - b)
                            .join(',')}`,
                        menuItemId: item.id,
                        name: item.name,
                        category: target.categories.find((category) => category.id === item.category_id)?.name ?? '',
                        qty: line.qty,
                        addons: line.addons,
                    };
                }),
        );
        setTab('order');
    };

    const shownSent = sent.filter((order) =>
        filter === 'All'
            ? true
            : filter === 'Waiting'
              ? order.status === 'sent'
              : filter === 'Accepted'
                ? order.status === 'accepted'
                : order.status === 'declined',
    );

    return (
        <>
            <Head title="Marketing" />
            <div className="bg-bg font-body text-text flex min-h-screen flex-col lg:h-screen">
                <MarketingBar active={tab} sentCount={sent.length} onTab={setTab} />

                {tab === 'order' ? (
                    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-5 py-4">
                            <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                                <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Sending to</div>
                                {branches.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => pickBranch(option)}
                                        className={cn(
                                            'rounded-btn min-h-11 cursor-pointer border px-4 text-[13.5px] font-semibold',
                                            option.id === branch.id ? 'border-accent bg-accent text-bg' : 'border-divider text-text bg-neutral-100',
                                        )}
                                    >
                                        {option.name}
                                    </button>
                                ))}
                                <div className="flex-1" />
                                <div className="text-text/74 text-[12.5px]">
                                    {branch.items.length} of {branch.total_items} items available at {branch.name}
                                </div>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                {branch.categories.map((category) => {
                                    const on = category.id === categoryId && !terms;

                                    return (
                                        <button
                                            key={category.id}
                                            type="button"
                                            onClick={() => {
                                                setCategoryId(category.id);
                                                setSearch('');
                                            }}
                                            className={cn(
                                                'mr-2.5 cursor-pointer border-0 border-b-2 bg-transparent px-1 py-2 text-[14.5px] font-semibold',
                                                on ? 'border-accent text-text' : 'text-text/60 border-transparent',
                                            )}
                                        >
                                            {categoryLabel(category.name)}
                                        </button>
                                    );
                                })}
                                <div className="flex-1" />
                                <input
                                    type="search"
                                    className="input w-[190px]"
                                    placeholder="Search menu"
                                    aria-label="Search menu"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                />
                            </div>

                            <div className="-mx-2.5 -mt-2.5 min-h-0 flex-1 overflow-auto px-2.5 pt-2.5 pb-2">
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3.5">
                                    {items.map((item) => {
                                        const qty = cart.filter((line) => line.menuItemId === item.id).reduce((sum, line) => sum + line.qty, 0);

                                        return (
                                            <div key={item.id} className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        item.addon_ids.length ? setPicking({ item, addonIds: [], qty: 1 }) : add(item, [], 1)
                                                    }
                                                    className="border-divider hover:border-accent-400 w-full cursor-pointer overflow-hidden rounded-md border bg-neutral-100 p-0 text-left shadow-[var(--shadow-sm)]"
                                                >
                                                    <div
                                                        className="bg-surface flex h-[104px] items-end bg-cover bg-center p-2"
                                                        style={item.photo_url ? { backgroundImage: `url("${item.photo_url}")` } : undefined}
                                                    >
                                                        {!item.photo_url && (
                                                            <span className="text-text/74 rounded-btn bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px]">
                                                                photo set in POS menu
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="px-3.5 pt-3 pb-3.5">
                                                        <div className="text-base leading-[1.15] font-semibold">{item.name}</div>
                                                        {item.note && <div className="text-text/74 mt-[3px] text-[11.5px]">{item.note}</div>}
                                                    </div>
                                                </button>
                                                <button
                                                    type="button"
                                                    title="Item details"
                                                    aria-label={`About ${item.name}`}
                                                    onClick={() => setInfo(item)}
                                                    className="border-divider text-text/74 hover:border-accent hover:text-accent-700 absolute top-2 left-2 z-[2] flex size-[34px] cursor-pointer items-center justify-center rounded-full border bg-neutral-100 text-[13px] font-semibold"
                                                >
                                                    ?
                                                </button>
                                                {qty > 0 && (
                                                    <div className="bg-accent text-bg absolute top-2 right-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-[7px] text-[13px] font-semibold tabular-nums">
                                                        {qty}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {items.length === 0 && (
                                    <div className="text-text/74 px-2 py-[34px] text-center text-sm">
                                        {terms
                                            ? `Nothing matches that search at ${branch.name}.`
                                            : `${branch.name} has nothing in this category right now.`}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-divider flex w-full flex-none flex-col border-t bg-neutral-100 lg:w-[420px] lg:border-t-0 lg:border-l">
                            <div className="border-divider border-b px-5 pt-4 pb-3">
                                <div className="bg-surface rounded-btn flex gap-1 p-1">
                                    {(['pickup', 'delivery'] as const).map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setService(option)}
                                            className={cn(
                                                'rounded-btn min-h-11 flex-1 cursor-pointer text-sm font-semibold',
                                                service === option ? 'bg-accent text-bg' : 'text-text bg-transparent',
                                            )}
                                        >
                                            {option === 'pickup' ? 'Pickup' : 'Delivery'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-5 py-3.5">
                                <div className="field mb-3">
                                    <label htmlFor="mk-customer">Customer or company</label>
                                    <input
                                        id="mk-customer"
                                        className="input w-full"
                                        maxLength={120}
                                        placeholder="e.g. Sunrise Dental Clinic"
                                        value={customer}
                                        onChange={(event) => setCustomer(event.target.value)}
                                    />
                                </div>
                                <div className="field mb-3">
                                    <label htmlFor="mk-phone">Contact number</label>
                                    <input
                                        id="mk-phone"
                                        className="input w-full"
                                        inputMode="tel"
                                        maxLength={40}
                                        placeholder="0917 000 0000"
                                        value={phone}
                                        onChange={(event) => setPhone(event.target.value)}
                                    />
                                </div>
                                <div className="field mb-3">
                                    <label htmlFor="mk-address">{service === 'delivery' ? 'Delivery address' : 'Pickup contact or office'}</label>
                                    <input
                                        id="mk-address"
                                        className="input w-full"
                                        maxLength={200}
                                        placeholder={service === 'delivery' ? 'Unit, street, barangay' : 'Who collects it, and where from'}
                                        value={address}
                                        onChange={(event) => setAddress(event.target.value)}
                                    />
                                </div>
                                <div className="mb-3 flex gap-2.5">
                                    <div className="field min-w-0 flex-1">
                                        <label htmlFor="mk-date">Needed on</label>
                                        <input
                                            id="mk-date"
                                            type="date"
                                            className="input w-full"
                                            value={wantedOn}
                                            onChange={(event) => setWantedOn(event.target.value)}
                                        />
                                    </div>
                                    <div className="field w-[132px] flex-none">
                                        <label htmlFor="mk-time">Time</label>
                                        <input
                                            id="mk-time"
                                            type="time"
                                            className="input w-full"
                                            value={wantedAt}
                                            onChange={(event) => setWantedAt(event.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="field mb-4">
                                    <label htmlFor="mk-note">Order notes</label>
                                    <input
                                        id="mk-note"
                                        className="input w-full"
                                        maxLength={200}
                                        placeholder="Packed per 6, invoice to accounting"
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                    />
                                </div>

                                <div className="mb-2 flex items-baseline justify-between">
                                    <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Items</div>
                                    <div className="text-text/74 text-[12.5px]">{countLabel}</div>
                                </div>
                                {cart.length === 0 && (
                                    <div className="text-text/74 px-2 pt-[18px] pb-[22px] text-center">
                                        <div className="text-text text-base font-semibold">No items yet</div>
                                        <div className="text-[13px]">Tap the menu to build the order.</div>
                                    </div>
                                )}
                                <div className="flex flex-col gap-2">
                                    {cart.map((line) => (
                                        <div
                                            key={line.key}
                                            className="border-divider bg-bg flex items-center gap-2.5 rounded-[8px] border px-3 py-2.5"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[14.5px] font-semibold">{line.name}</div>
                                                <div className="text-text/74 text-[11.5px]">
                                                    {[categoryLabel(line.category), line.addons.map((addon) => addon.name).join(', ')]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                aria-label={`One less ${line.name}`}
                                                onClick={() => setQty(line.key, line.qty - 1)}
                                                className="border-divider rounded-btn size-[34px] flex-none cursor-pointer border bg-neutral-100 text-base font-semibold"
                                            >
                                                −
                                            </button>
                                            <input
                                                className="input w-14 text-center tabular-nums"
                                                aria-label={`${line.name} quantity`}
                                                inputMode="numeric"
                                                value={line.qty}
                                                onChange={(event) =>
                                                    setQty(line.key, Math.min(999, parseInt(event.target.value.replace(/\D/g, ''), 10) || 0))
                                                }
                                            />
                                            <button
                                                type="button"
                                                aria-label={`One more ${line.name}`}
                                                onClick={() => setQty(line.key, line.qty + 1)}
                                                className="border-divider rounded-btn size-[34px] flex-none cursor-pointer border bg-neutral-100 text-base font-semibold"
                                            >
                                                +
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${line.name}`}
                                                title="Remove"
                                                onClick={() => setQty(line.key, 0)}
                                                className="border-divider text-text/74 rounded-btn size-[34px] flex-none cursor-pointer border bg-transparent text-[15px]"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-divider border-t bg-neutral-100 px-5 pt-3.5 pb-4">
                                <div className="mb-2.5 flex items-baseline justify-between">
                                    <span className="text-[15px] font-semibold">To {branch.name}</span>
                                    <span className="text-text/74 text-[12.5px]">{when}</span>
                                </div>
                                <div className="flex gap-2.5">
                                    <button
                                        type="button"
                                        onClick={clear}
                                        className="border-divider bg-bg rounded-btn cursor-pointer border px-[18px] py-3 text-sm font-semibold"
                                    >
                                        Clear
                                    </button>
                                    <button type="button" onClick={openSend} className="btn btn-primary flex-1 p-3 text-[15px] font-semibold">
                                        Send order
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto px-4 py-[26px] sm:px-[30px]">
                        <div className="mb-1 flex flex-wrap items-center gap-4">
                            <h2 className="m-0 text-[26px]">Orders I sent</h2>
                            <div className="flex-1" />
                            <div className="flex flex-wrap gap-1.5">
                                {(['All', 'Waiting', 'Accepted', 'Declined'] as const).map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => setFilter(option)}
                                        className={cn(
                                            'rounded-btn min-h-10 cursor-pointer border px-3.5 text-[13px] font-semibold',
                                            filter === option ? 'border-accent bg-accent text-bg' : 'border-divider text-text bg-neutral-100',
                                        )}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="text-text/74 mt-0 mb-[22px] text-[13.5px]">
                            The branch sees each order on its till. Status updates as they accept it and work through it.
                        </p>

                        {shownSent.length === 0 && (
                            <div className="text-text/74 px-2 py-10 text-center text-sm">
                                Nothing here yet. Orders you send show up with their branch status.
                            </div>
                        )}
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-4">
                            {shownSent.map((order) => (
                                <SentCard key={order.id} order={order} onCopy={() => copyToNew(order)} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {picking && (
                <Sheet
                    open
                    onClose={() => setPicking(null)}
                    title={picking.item.name}
                    description={picking.item.note ?? undefined}
                    width="max-w-[440px]"
                >
                    <div className="text-text/74 mb-[9px] text-[11.5px] tracking-[.08em] uppercase">Add-ons</div>
                    <div className="mb-[22px] flex flex-wrap gap-2">
                        {branch.addons
                            .filter((addon) => picking.item.addon_ids.includes(addon.id))
                            .map((addon) => {
                                const on = picking.addonIds.includes(addon.id);

                                return (
                                    <button
                                        key={addon.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() =>
                                            setPicking({
                                                ...picking,
                                                addonIds: on ? picking.addonIds.filter((id) => id !== addon.id) : [...picking.addonIds, addon.id],
                                            })
                                        }
                                        className={choiceClass(on) + ' min-h-11 px-4 text-[13.5px]'}
                                    >
                                        {addon.name}
                                    </button>
                                );
                            })}
                    </div>
                    <div className="mb-[22px] flex items-center gap-3">
                        <span className="flex-1 text-sm">Quantity</span>
                        <button
                            type="button"
                            aria-label="One less"
                            onClick={() => setPicking({ ...picking, qty: Math.max(1, picking.qty - 1) })}
                            className="border-divider rounded-btn size-11 cursor-pointer border bg-neutral-100 text-lg"
                        >
                            −
                        </button>
                        <span className="min-w-8 text-center text-[17px] font-semibold tabular-nums">{picking.qty}</span>
                        <button
                            type="button"
                            aria-label="One more"
                            onClick={() => setPicking({ ...picking, qty: picking.qty + 1 })}
                            className="border-divider rounded-btn size-11 cursor-pointer border bg-neutral-100 text-lg"
                        >
                            +
                        </button>
                    </div>
                    <div className="flex gap-2.5">
                        <button type="button" onClick={() => setPicking(null)} className="btn btn-secondary flex-1 p-[13px] font-semibold">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => add(picking.item, picking.addonIds, picking.qty)}
                            className="btn btn-primary flex-1 p-[13px] font-semibold"
                        >
                            Add {picking.qty} to order
                        </button>
                    </div>
                </Sheet>
            )}

            {info && (
                <Sheet open onClose={() => setInfo(null)} title={info.name} width="max-w-[420px]">
                    {info.photo_url && (
                        <div
                            className="bg-surface my-3 h-[196px] rounded-[8px] bg-cover bg-center"
                            style={{ backgroundImage: `url("${info.photo_url}")` }}
                        />
                    )}
                    {info.note && <p className="mt-2 mb-1.5 text-[13.5px]">{info.note}</p>}
                    <p className="text-text/74 mt-0 mb-5 text-[12.5px]">
                        {categoryLabel(categoryName(info.category_id))} · Available at {branch.name}
                    </p>
                    <button type="button" onClick={() => setInfo(null)} className="btn btn-secondary btn-block w-full p-3 font-semibold">
                        Close
                    </button>
                </Sheet>
            )}

            <Sheet
                open={sending}
                onClose={() => setSending(false)}
                title={`Send to ${branch.name}`}
                description="The branch gets a notification on its till and confirms from there."
                width="max-w-[560px]"
            >
                <div className="bg-surface mb-4 rounded-md px-[18px] py-3.5">
                    <div className="text-base font-semibold">{customer.trim() || 'Walk-in customer'}</div>
                    <div className="text-text/74 text-[13px]">
                        {[service === 'delivery' ? 'Delivery' : 'Pickup', phone.trim(), address.trim()].filter(Boolean).join(' · ')}
                    </div>
                </div>
                <div className="bg-surface mb-[18px] rounded-md px-[18px] pt-1.5 pb-3">
                    {cart.map((line) => (
                        <div key={line.key} className="border-divider flex gap-2.5 border-b py-2 text-sm">
                            <span className="min-w-[42px] font-semibold tabular-nums">{line.qty}×</span>
                            <span className="min-w-0 flex-1">
                                {line.name}
                                {line.addons.length > 0 && (
                                    <span className="text-text/74"> · {line.addons.map((addon) => addon.name).join(', ')}</span>
                                )}
                            </span>
                        </div>
                    ))}
                    <div className="flex justify-between pt-2.5 text-sm font-semibold">
                        <span>{countLabel}</span>
                        <span>{when}</span>
                    </div>
                </div>
                <div className="flex gap-2.5">
                    <button type="button" onClick={() => setSending(false)} className="btn btn-secondary px-5 py-3.5 text-sm font-semibold">
                        Back
                    </button>
                    <button
                        type="button"
                        disabled={processing}
                        onClick={send}
                        className="btn btn-primary flex-1 p-3.5 text-[15px] font-semibold disabled:opacity-60"
                    >
                        Send to branch
                    </button>
                </div>
            </Sheet>

            <Toast message={toast} />
        </>
    );
}

function SentCard({ order, onCopy }: { order: MarketingOrderView; onCopy: () => void }) {
    const tone =
        order.status === 'declined'
            ? 'bg-accent-2-800 text-neutral-100'
            : order.progress === 'Ready' || order.progress === 'Served'
              ? 'bg-neutral-800 text-neutral-100'
              : order.status === 'accepted'
                ? 'bg-accent text-bg'
                : 'bg-surface text-text';

    return (
        <div
            className={cn(
                'rounded-md border bg-neutral-100 p-[18px] shadow-[var(--shadow-sm)]',
                order.status === 'declined' ? 'border-accent-2-400' : order.status === 'accepted' ? 'border-accent-300' : 'border-divider',
            )}
        >
            <div className="mb-2.5 flex items-center justify-between gap-2.5">
                <div className="text-xl font-semibold">{order.no}</div>
                <span
                    className={cn(
                        'rounded-btn inline-flex items-center gap-[7px] px-[13px] py-1.5 text-[12.5px] font-semibold tracking-[.06em] whitespace-nowrap uppercase',
                        tone,
                    )}
                >
                    <span className="size-2 flex-none rounded-full bg-current" />
                    {order.progress}
                    {order.paid ? ' · paid' : ''}
                </span>
            </div>
            <div className="text-[15px] font-semibold">{order.customer}</div>
            <div className="text-text/74 mb-3 text-[12.5px]">
                {order.branch} · {order.service_label} · {order.wanted}
            </div>
            <div className="flex max-h-40 flex-col gap-[3px] overflow-auto overscroll-contain text-[13.5px]">
                {order.lines.map((line, index) => (
                    <div key={index}>
                        {line.qty}× {line.name}
                        {line.addons.length > 0 && <span className="text-text/74"> · {line.addons.map((addon) => addon.name).join(', ')}</span>}
                    </div>
                ))}
            </div>
            {order.note && <div className="bg-accent-100 mt-2.5 rounded-[8px] px-[11px] py-2 text-[12.5px]">{order.note}</div>}
            {order.reply && (
                <div className="bg-surface mt-2.5 rounded-[8px] px-[11px] py-2 text-[12.5px]">
                    <strong>{order.replied_by?.split(' ')[0] ?? 'Branch'}:</strong> {order.reply}
                </div>
            )}
            <div className="border-divider text-text/74 mt-3.5 flex items-center justify-between border-t pt-3 text-[12.5px]">
                <span>
                    Sent {new Date(order.sent_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
                <button
                    type="button"
                    onClick={onCopy}
                    className="border-divider text-text hover:border-accent hover:bg-accent-100 rounded-btn inline-flex min-h-10 cursor-pointer items-center border bg-neutral-100 px-[15px] text-[13px] font-semibold"
                >
                    Copy to new order
                </button>
            </div>
        </div>
    );
}
