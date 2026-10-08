import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { omit, trim, type ScreenData, type ShopLine } from '@/lib/inventory';
import { escapeHtml } from '@/lib/report';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const GROUPS: { key: ShopLine['location']; label: string }[] = [
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'commissary', label: 'Commissary' },
    { key: null, label: 'Manual' },
];

const GRID = 'grid min-w-[440px] grid-cols-[30px_minmax(140px,2.4fr)_minmax(112px,132px)_minmax(80px,110px)_40px] gap-2.5';

/**
 * The shopping list: lines copied from below-par items or added by hand, ticked for the next order and
 * exported as a printable purchase list.
 */
export function ShoppingList({ data, toast }: { data: ScreenData<'shop'>; toast: (message: string) => void }) {
    const { auth } = usePage<SharedData>().props;
    const [shut, setShut] = useState<Record<string, boolean>>({});
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [editingId, setEditingId] = useState<number | null>(null);
    const [openNewest, setOpenNewest] = useState(false);
    const [removing, setRemoving] = useState<ShopLine[] | null>(null);
    const [orderTo, setOrderTo] = useState('');
    const [deliverTo, setDeliverTo] = useState(data.deliverTo[0] ?? '');
    const { send, processing } = useBackOfficeAction(toast);

    const ticked = data.lines.filter((line) => line.ticked);
    const total = ticked.reduce((sum, line) => sum + line.qty * line.cost, 0);
    const editing = data.lines.find((line) => line.id === editingId) ?? null;

    useEffect(() => {
        if (openNewest && data.lines.length) {
            setEditingId(Math.max(...data.lines.map((line) => line.id)));
            setOpenNewest(false);
        }
    }, [data.lines, openNewest]);

    const patch = (line: ShopLine, fields: Partial<Pick<ShopLine, 'name' | 'cost' | 'qty' | 'ticked'>>) =>
        send('patch', route('inventory.shopping.update', line.id), fields);

    const setQty = (line: ShopLine, value: number) => {
        const next = Math.max(0, Math.round(value * 10) / 10);
        setDrafts((current) => omit(current, line.id));

        if (next !== line.qty) {
            patch(line, { qty: next });
        }
    };

    const exportPdf = () => {
        if (!ticked.length) {
            toast('Select at least one line first');

            return;
        }

        const frame = window.open('', '_blank');

        if (!frame) {
            toast('Allow pop-ups to export the PDF');

            return;
        }

        const when = new Date().toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        const body = ticked
            .map(
                (line, index) =>
                    `<tr><td class=n>${index + 1}</td><td>${escapeHtml(line.name).split('\n').join('<br>')}</td><td class=n>${escapeHtml(`${trim(line.qty)} ${line.unit}`)}</td><td class=n>${peso(line.cost)}</td><td class=n>${peso(line.qty * line.cost)}</td></tr>`,
            )
            .join('');

        frame.document.write(
            '<!doctype html><meta charset="utf-8"><title>Shopping list</title>' +
                '<style>@page{size:letter;margin:18mm}body{font:13px/1.5 "Figtree",system-ui,sans-serif;color:#201e1d;margin:0}' +
                'h1{font-size:22px;margin:0 0 4px}.meta{font-size:12px;color:#6b6560;margin-bottom:18px}' +
                '.grid{display:grid;grid-template-columns:auto auto;gap:2px 18px;font-size:12.5px;margin-bottom:20px;justify-content:start}' +
                '.k{color:#6b6560}table{width:100%;border-collapse:collapse}' +
                'th{text-align:left;font-weight:700;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#6b6560;border-bottom:1px solid #d9cfc0;padding:7px 8px}' +
                'td{padding:8px;border-bottom:1px solid #e8dfd1;vertical-align:top}.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
                'tfoot td{border:0;border-top:1.5px solid #201e1d;font-weight:700}</style>' +
                `<h1>Shopping list</h1><div class=meta>D' Mezzanine Cafe · raised ${escapeHtml(when)} by ${escapeHtml(auth.user.name)}</div>` +
                `<div class=grid><div class=k>Order to</div><div>${escapeHtml(orderTo.trim() || 'Unassigned')}</div><div class=k>Deliver to</div><div>${escapeHtml(deliverTo)}</div><div class=k>Lines</div><div>${ticked.length}</div></div>` +
                `<table><thead><tr><th>#</th><th>Description</th><th class=n>Qty</th><th class=n>Unit cost</th><th class=n>Total</th></tr></thead><tbody>${body}</tbody>` +
                `<tfoot><tr><td colspan="4" class=n>Total</td><td class=n>${peso(total)}</td></tr></tfoot></table>`,
        );
        frame.document.close();
        setTimeout(() => {
            frame.focus();
            frame.print();
        }, 350);
        toast(`${ticked.length} lines sent to the print view`);
    };

    return (
        <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-[1_1_520px]">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <div className="text-text/74 text-[12.5px]">{data.lines.length} lines enlisted</div>
                    <div className="flex-1" />
                    <button
                        type="button"
                        disabled={processing}
                        onClick={() =>
                            send(
                                'post',
                                route('inventory.shopping.store'),
                                {},
                                { success: 'Manual line added — fill in the details', onSuccess: () => setOpenNewest(true) },
                            )
                        }
                        className="bg-accent hover:bg-accent-700 rounded-btn inline-flex min-h-10 cursor-pointer items-center gap-1.5 px-[13px] py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-neutral-100"
                    >
                        <span className="text-sm leading-none">+</span>Add line
                    </button>
                    {ticked.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setRemoving(ticked)}
                            className="border-divider bg-surface text-text rounded-btn min-h-10 cursor-pointer border px-[13px] py-[7px] text-[12.5px] whitespace-nowrap"
                        >
                            Remove {ticked.length} selected
                        </button>
                    )}
                </div>
                <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                    <div
                        className={cn(
                            GRID,
                            'border-divider border-b bg-neutral-200 px-3.5 py-3 text-xs font-bold tracking-[.08em] text-neutral-800 uppercase',
                        )}
                    >
                        <div />
                        <div>Details</div>
                        <div className="text-center">Quantity</div>
                        <div className="text-right">Cost</div>
                        <div />
                    </div>
                    {GROUPS.map((group) => {
                        const rows = data.lines.filter((line) => line.location === group.key);

                        if (!rows.length) {
                            return null;
                        }

                        const closed = shut[group.label];

                        return (
                            <div key={group.label}>
                                <button
                                    type="button"
                                    aria-expanded={!closed}
                                    onClick={() => setShut({ ...shut, [group.label]: !closed })}
                                    className="border-divider flex w-full min-w-[440px] cursor-pointer items-center gap-2.5 border-b bg-neutral-900 px-3.5 py-[11px] text-left text-neutral-100"
                                >
                                    <span className="w-2.5 text-[10px] opacity-70">{closed ? '▶' : '▼'}</span>
                                    <span className="text-[12.5px] font-semibold tracking-[.09em] uppercase">{group.label}</span>
                                    <span className="bg-accent rounded-full px-[9px] py-0.5 text-[11.5px] whitespace-nowrap">
                                        {rows.length} {rows.length === 1 ? 'line' : 'lines'}
                                    </span>
                                </button>
                                {!closed &&
                                    rows.map((line) => (
                                        <div key={line.id} className="border-divider border-b">
                                            <div className={cn(GRID, 'items-center px-3.5 py-3', !line.ticked && 'opacity-72')}>
                                                <button
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={line.ticked}
                                                    aria-label={`Select ${line.name.split('\n')[0]}`}
                                                    onClick={() => patch(line, { ticked: !line.ticked })}
                                                    className={cn(
                                                        'flex size-[18px] cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] p-0 text-[11px] leading-none text-neutral-100',
                                                        line.ticked ? 'border-accent bg-accent' : 'border-divider bg-transparent',
                                                    )}
                                                >
                                                    {line.ticked ? '✓' : ''}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(line.id)}
                                                    className="min-w-0 cursor-pointer bg-transparent p-0 text-left"
                                                >
                                                    <span className="block truncate text-sm">{line.name.split('\n')[0]}</span>
                                                    <span className="text-text/74 mt-[3px] block truncate text-[11.5px]">
                                                        {line.reason ?? 'Added manually'}
                                                    </span>
                                                </button>
                                                <div className="flex items-center justify-center gap-[7px]">
                                                    <button
                                                        type="button"
                                                        aria-label={`One less ${line.name}`}
                                                        onClick={() => setQty(line, line.qty - 1)}
                                                        className="border-divider bg-bg size-[26px] cursor-pointer rounded-full border text-sm leading-none"
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        aria-label={`${line.name} quantity`}
                                                        inputMode="decimal"
                                                        value={drafts[line.id] ?? trim(line.qty)}
                                                        onChange={(event) =>
                                                            setDrafts({ ...drafts, [line.id]: event.target.value.replace(/[^0-9.]/g, '') })
                                                        }
                                                        onBlur={() => drafts[line.id] !== undefined && setQty(line, parseFloat(drafts[line.id]) || 0)}
                                                        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                                                        className="border-divider bg-surface text-text rounded-btn w-[52px] border px-0.5 py-[3px] text-center text-[15px] font-semibold tabular-nums"
                                                    />
                                                    <button
                                                        type="button"
                                                        aria-label={`One more ${line.name}`}
                                                        onClick={() => setQty(line, line.qty + 1)}
                                                        className="border-divider bg-bg size-[26px] cursor-pointer rounded-full border text-sm leading-none"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <div className="text-right text-[13.5px] tabular-nums">{peso(line.qty * line.cost)}</div>
                                                <button
                                                    type="button"
                                                    title="Remove item"
                                                    aria-label={`Remove ${line.name}`}
                                                    onClick={() => setRemoving([line])}
                                                    className="border-divider rounded-btn size-[26px] cursor-pointer justify-self-end border bg-transparent text-[13px]"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        );
                    })}
                    {data.lines.length === 0 && (
                        <div className="text-text/74 p-[34px] text-center text-[13.5px]">
                            Nothing enlisted yet. Add items from Needs attention or the stock screens.
                        </div>
                    )}
                </div>
            </div>

            <div className="min-w-0 flex-[0_1_clamp(240px,22vw,300px)]">
                <div className="rounded-md bg-neutral-900 px-4 py-[15px] text-neutral-100">
                    <div className="text-[11.5px] tracking-[.08em] uppercase opacity-85">Selected total</div>
                    <div className="mt-1 text-[21px] leading-none font-semibold tabular-nums">{peso(total)}</div>
                    <div className="text-[12.5px] opacity-75">
                        {ticked.length} of {data.lines.length} lines selected
                    </div>
                    <div className="my-3 h-px bg-white/14" />
                    <label htmlFor="order-to" className="mb-[5px] block text-[11px] tracking-[.07em] uppercase opacity-85">
                        Order to
                    </label>
                    <input
                        id="order-to"
                        list="order-to-suppliers"
                        value={orderTo}
                        onChange={(event) => setOrderTo(event.target.value)}
                        placeholder="Supplier name"
                        className="rounded-btn mb-[11px] w-full border border-white/20 bg-white/8 px-[9px] py-2 text-[13px] text-neutral-100"
                    />
                    <datalist id="order-to-suppliers">
                        {data.suppliers.map((name) => (
                            <option key={name} value={name} />
                        ))}
                    </datalist>
                    <label htmlFor="deliver-to" className="mb-[5px] block text-[11px] tracking-[.07em] uppercase opacity-85">
                        Deliver to
                    </label>
                    <select
                        id="deliver-to"
                        value={deliverTo}
                        onChange={(event) => setDeliverTo(event.target.value)}
                        className="rounded-btn mb-[13px] w-full cursor-pointer border border-white/20 bg-white/8 px-[9px] py-2 text-[13px] text-neutral-100"
                    >
                        {data.deliverTo.map((name) => (
                            <option key={name} value={name} className="text-text">
                                {name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={exportPdf}
                        className={cn(
                            'bg-accent rounded-btn min-h-11 w-full cursor-pointer p-2.5 text-[13.5px] font-semibold text-neutral-100',
                            !ticked.length && 'opacity-45',
                        )}
                    >
                        Export as PDF
                    </button>
                    <p className="mt-[9px] mb-0 text-[11px] opacity-60">Opens a print view of the ticked lines — save as PDF.</p>
                </div>
            </div>

            <LineSheet
                key={editing?.id ?? 'closed'}
                line={editing}
                onRemove={(line) => {
                    setEditingId(null);
                    setRemoving([line]);
                }}
                onSave={(line, fields) => {
                    const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => line[key as keyof ShopLine] !== value));

                    if (Object.keys(changed).length) {
                        patch(line, changed);
                    }

                    setEditingId(null);
                }}
            />
            <ConfirmDialog
                open={removing !== null}
                title={removing && removing.length > 1 ? 'Remove selected lines?' : 'Remove from shopping list?'}
                body={
                    removing
                        ? removing.length > 1
                            ? `${removing.length} lines will leave the shopping list: ${removing.map((line) => line.name.split('\n')[0]).join(', ')}`
                            : `${removing[0].name.split('\n')[0]} · ${trim(removing[0].qty)} ${removing[0].unit}`
                        : ''
                }
                cancelLabel={removing && removing.length > 1 ? 'Keep them' : 'Keep it'}
                confirmLabel={removing && removing.length > 1 ? 'Remove lines' : 'Remove'}
                onCancel={() => setRemoving(null)}
                onConfirm={() =>
                    removing &&
                    send(
                        'delete',
                        route('inventory.shopping.destroy'),
                        { ids: removing.map((line) => line.id) },
                        {
                            success:
                                removing.length > 1
                                    ? `${removing.length} lines removed from list`
                                    : `${removing[0].name.split('\n')[0]} removed from list`,
                            onSuccess: () => setRemoving(null),
                        },
                    )
                }
            />
        </div>
    );
}

/**
 * Edit a line's description, unit cost and quantity. Closing it saves what changed.
 */
function LineSheet({
    line,
    onRemove,
    onSave,
}: {
    line: ShopLine | null;
    onRemove: (line: ShopLine) => void;
    onSave: (line: ShopLine, fields: { name: string; cost: number; qty: number }) => void;
}) {
    const [name, setName] = useState(line?.name ?? '');
    const [cost, setCost] = useState(line ? String(line.cost) : '');
    const [qty, setQty] = useState(line ? trim(line.qty) : '');
    const total = (parseFloat(cost) || 0) * (parseFloat(qty) || 0);

    const done = () => line && onSave(line, { name: name.trim() || line.name, cost: parseFloat(cost) || 0, qty: Math.max(0, parseFloat(qty) || 0) });

    return (
        <Sheet open={line !== null} onClose={done} title="Edit line" width="max-w-[460px]" className="z-[64]">
            <div className="text-text/74 -mt-1 mb-[18px] text-[11px] tracking-[.08em] uppercase">
                {line?.location ? `${line.location[0].toUpperCase()}${line.location.slice(1)}` : 'Manual'} line
            </div>
            <label className="text-text/74 mb-3.5 flex flex-col gap-[5px] text-[11px] tracking-[.07em] uppercase">
                Description
                <textarea
                    value={name}
                    rows={Math.max(3, name.split('\n').length)}
                    onChange={(event) => setName(event.target.value)}
                    className="border-divider bg-bg text-text rounded-btn focus:border-accent min-h-16 w-full resize-none border px-2.5 py-2 text-[13.5px] leading-[1.45] tracking-normal normal-case"
                />
            </label>
            <div className="mb-1.5 grid grid-cols-2 gap-3.5">
                <label className="text-text/74 flex flex-col gap-[5px] text-[11px] tracking-[.07em] uppercase">
                    Unit cost
                    <input
                        inputMode="decimal"
                        value={cost}
                        onChange={(event) => setCost(event.target.value.replace(/[^0-9.]/g, ''))}
                        className="border-divider bg-bg text-text rounded-btn focus:border-accent w-full border px-2.5 py-2 text-[13.5px] tabular-nums"
                    />
                </label>
                <label className="text-text/74 flex flex-col gap-[5px] text-[11px] tracking-[.07em] uppercase">
                    Quantity
                    <input
                        inputMode="decimal"
                        value={qty}
                        onChange={(event) => setQty(event.target.value.replace(/[^0-9.]/g, ''))}
                        className="border-divider bg-bg text-text rounded-btn focus:border-accent w-full border px-2.5 py-2 text-[13.5px] tabular-nums"
                    />
                </label>
            </div>
            <div className="text-text/74 mb-5 text-[12.5px]">Line total {peso(total)}</div>
            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={() => line && onRemove(line)}
                    className="border-divider rounded-btn min-h-11 cursor-pointer border bg-transparent px-3.5 py-[11px] text-[13px]"
                >
                    Remove line
                </button>
                <div className="flex-1" />
                <button type="button" onClick={done} className="btn btn-primary px-[22px] py-[11px] text-[13.5px] font-semibold">
                    Done
                </button>
            </div>
        </Sheet>
    );
}
