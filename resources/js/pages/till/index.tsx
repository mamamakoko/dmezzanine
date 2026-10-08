import { BackOffice } from '@/components/till/back-office/back-office';
import { InboxSheet } from '@/components/till/inbox-sheet';
import { MenuBoard } from '@/components/till/menu-board';
import { ModifierSheet } from '@/components/till/modifier-sheet';
import { OrderPanel, SERVICES, type Service } from '@/components/till/order-panel';
import { PaymentSheet } from '@/components/till/payment-sheet';
import { PinLock } from '@/components/till/pin-lock';
import { QueueBoard } from '@/components/till/queue-board';
import { ReceiptSheet } from '@/components/till/receipt-sheet';
import { SendSheet } from '@/components/till/send-sheet';
import { ConfirmDialog, Toast } from '@/components/till/sheet';
import { TopBar, type TillScreen } from '@/components/till/top-bar';
import { useToast } from '@/hooks/use-toast';
import { openBackOffice, type BackOfficeData } from '@/lib/back-office';
import { type MarketingOrderView } from '@/lib/marketing';
import {
    connectPrinter,
    disconnectPrinter,
    isPrinterConnected,
    PrinterError,
    printSlip,
    receiptText,
    slipText,
    ticketText,
    type SlipKind,
} from '@/lib/printer';
import {
    firstError,
    modsLabel,
    NEXT_STATUS,
    orderTotals,
    pad2,
    type CartLine,
    type PaymentInput,
    type TillAddon,
    type TillBranch,
    type TillCategory,
    type TillChoice,
    type TillMenuItem,
    type TillOrder,
    type TillPaymentMethod,
    type TillStaff,
} from '@/lib/till';
import { type SharedData } from '@/types';
import { type VisitOptions } from '@inertiajs/core';
import { Head, Link, router, usePage, usePoll } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

interface TillPageProps {
    orderOnly: boolean;
    branch: TillBranch | null;
    staff?: TillStaff | null;
    canOpenRestrictedTabs?: boolean;
    tickets?: number;
    openTickets?: number[];
    nextOrderNo?: number;
    categories?: TillCategory[];
    menu?: TillMenuItem[];
    addons?: TillAddon[];
    sizes?: TillChoice[];
    milks?: TillChoice[];
    paymentMethods?: TillPaymentMethod[];
    queue?: TillOrder[];
    receipt?: TillOrder | null;
    /** Orders marketing sent to this branch: waiting ones and those answered in the last few days. */
    inbox?: MarketingOrderView[];
    /** Whether the staff member at the till runs this branch's back office (its lead or the Owner). */
    canManageBranch?: boolean;
    /** The open back-office tab's data, when the back office is open. */
    backOffice?: BackOfficeData | null;
}

type ReadyTillProps = Required<TillPageProps> & { branch: TillBranch; staff: TillStaff };

/**
 * The branch till. POS (orderOnly false) opens on the PIN pad, then takes orders and payment and runs the
 * queue board. The Branch Menu (orderOnly true) is the same till with no prices or payment; it sends
 * orders and their tickets to the cashier.
 */
export default function TillIndex(props: TillPageProps) {
    const { auth } = usePage<SharedData>().props;
    const now = useNow();
    const title = props.orderOnly ? 'Branch menu' : 'POS';

    if (props.branch === null) {
        return (
            <>
                <Head title={title} />
                <div className="font-body flex min-h-screen flex-col items-start justify-center gap-3 bg-neutral-900 px-4 text-neutral-100 sm:px-[52px]">
                    <div className="text-gold text-[11px] tracking-[.16em] uppercase">Till</div>
                    <h1 className="m-0 text-[32px] leading-[1.12]">No branch on this account</h1>
                    <p className="m-0 max-w-[40ch] text-sm text-neutral-100/66">
                        The till runs at a branch. Ask the owner to assign your account to one.
                    </p>
                    <Link href={route('home')} className="text-gold mt-4 text-sm">
                        ← Back to workspaces
                    </Link>
                </div>
            </>
        );
    }

    if (!props.staff) {
        const hour = now.getHours();
        const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

        return (
            <>
                <Head title={title} />
                <PinLock branchName={props.branch.name} greeting={`${part}, ${auth.user.name.split(' ')[0]}.`} clock={clockLabel(now)} />
            </>
        );
    }

    return (
        <>
            <Head title={title} />
            <Till {...(props as ReadyTillProps)} now={now} />
        </>
    );
}

function Till(props: ReadyTillProps & { now: Date }) {
    const { orderOnly, branch, menu, addons, sizes, milks, paymentMethods, openTickets, queue, receipt, now } = props;

    const [screen, setScreen] = useState<TillScreen>('till');
    const [categoryId, setCategoryId] = useState<number | null>(props.categories[0]?.id ?? null);
    const [search, setSearch] = useState('');
    const [service, setService] = useState<Service>('dine_in');
    const [ticket, setTicket] = useState(() => firstFreeTicket(props.tickets, openTickets, 0));
    const [cart, setCart] = useState<CartLine[]>([]);
    const [senior, setSenior] = useState(false);
    const [note, setNote] = useState('');
    const [modifierItem, setModifierItem] = useState<TillMenuItem | null>(null);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [settling, setSettling] = useState<{ order: TillOrder; senior: boolean } | null>(null);
    const [processing, setProcessing] = useState(false);
    const [dismissedReceiptId, setDismissedReceiptId] = useState<number | null>(null);
    const [printerName, setPrinterName] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{ kind: 'exit' | 'void' } | { kind: 'serve'; order: TillOrder } | null>(null);
    const [printAsk, setPrintAsk] = useState<{ kind: SlipKind; order: TillOrder } | null>(null);
    const [inboxOpen, setInboxOpen] = useState(false);
    const [toast, showToast] = useToast();

    usePoll(15000, { only: orderOnly ? ['openTickets', 'nextOrderNo'] : ['openTickets', 'nextOrderNo', 'queue', 'inbox'] });

    // Another till may take the selected ticket; move on to the next free one.
    useEffect(() => {
        if (openTickets.includes(ticket)) {
            setTicket(firstFreeTicket(props.tickets, openTickets, ticket));
        }
    }, [openTickets, ticket, props.tickets]);

    const gross = cart.reduce((sum, line) => sum + line.each * line.qty, 0);
    const totals = orderTotals(gross, senior);
    const itemCount = cart.reduce((count, line) => count + line.qty, 0);
    const itemsLabel = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
    const serviceLabel = SERVICES.find((candidate) => candidate.value === service)?.label;
    const inOrder = useMemo(
        () =>
            cart.reduce<Record<number, number>>((counts, line) => ({ ...counts, [line.menuItemId]: (counts[line.menuItemId] ?? 0) + line.qty }), {}),
        [cart],
    );

    const addLine = (item: TillMenuItem, size: TillChoice | undefined, milk: TillChoice | undefined, picked: TillAddon[], qty: number) => {
        const addonIds = picked.map((addon) => addon.id).sort((a, b) => a - b);
        const key = [item.id, size?.value, milk?.value, addonIds.join('+')].join('|');
        const each = (item.price ?? 0) + (size?.price ?? 0) + (milk?.price ?? 0) + picked.reduce((sum, addon) => sum + (addon.price ?? 0), 0);

        setCart((current) =>
            current.some((line) => line.key === key)
                ? current.map((line) => (line.key === key ? { ...line, qty: line.qty + qty } : line))
                : [
                      ...current,
                      {
                          key,
                          menuItemId: item.id,
                          name: item.name,
                          each,
                          qty,
                          size: size?.value ?? null,
                          milk: milk?.value ?? null,
                          addonIds,
                          mods: modsLabel(size, milk, picked),
                      },
                  ],
        );
        setModifierItem(null);
    };

    const pickItem = (item: TillMenuItem) => (item.has_modifiers ? setModifierItem(item) : addLine(item, undefined, undefined, [], 1));

    const changeQty = (key: string, delta: number) =>
        setCart((current) => current.map((line) => (line.key === key ? { ...line, qty: line.qty + delta } : line)).filter((line) => line.qty > 0));

    const clearOrder = () => {
        setCart([]);
        setSenior(false);
        setNote('');
    };

    const visitOptions = (onSuccess: () => void): VisitOptions => ({
        preserveScroll: true,
        onStart: () => setProcessing(true),
        onFinish: () => setProcessing(false),
        onSuccess,
        onError: (errors) => showToast(firstError(errors)),
    });

    const orderPayload = () => ({
        service,
        ticket,
        note,
        lines: cart.map((line) => ({ menu_item_id: line.menuItemId, qty: line.qty, size: line.size, milk: line.milk, addon_ids: line.addonIds })),
    });

    const charge = (payment: PaymentInput) =>
        router.post(
            route('pos.orders.store'),
            { ...orderPayload(), senior, ...payment },
            visitOptions(() => {
                clearOrder();
                setCheckoutOpen(false);
            }),
        );

    const send = () =>
        router.post(
            route('menu.orders.store'),
            orderPayload(),
            visitOptions(() => {
                clearOrder();
                setCheckoutOpen(false);
            }),
        );

    const settle = (payment: PaymentInput) => {
        if (settling) {
            router.post(
                route('pos.orders.settle', settling.order.id),
                { senior: settling.senior, ...payment },
                visitOptions(() => setSettling(null)),
            );
        }
    };

    const advance = (order: TillOrder) => {
        const next = NEXT_STATUS[order.status];

        if (next === 'served') {
            setConfirm({ kind: 'serve', order });
        } else if (next) {
            router.patch(
                route('pos.orders.status', order.id),
                { status: next },
                { preserveScroll: true, onError: (errors) => showToast(firstError(errors)) },
            );
        }
    };

    const togglePrinter = () => {
        if (printerName) {
            disconnectPrinter();
            setPrinterName(null);
            showToast('Printer released');

            return;
        }

        connectPrinter()
            .then((name) => {
                if (name) {
                    setPrinterName(name);
                    showToast(`Printer connected · ${name}`);
                }
            })
            .catch((error) => showToast(error instanceof PrinterError ? error.message : 'Could not connect the printer'));
    };

    const print = ({ kind, order }: { kind: SlipKind; order: TillOrder }) => {
        const text = kind === 'ticket' ? ticketText(order) : kind === 'slip' ? slipText(order, branch.name) : receiptText(order, branch.name);

        printSlip(kind, text)
            .then(() => showToast(kind === 'ticket' ? `Ticket ${pad2(order.ticket)} sent to the printer` : 'Sent to the counter printer'))
            .catch((error) => showToast(error instanceof PrinterError ? error.message : 'Printing failed'));
    };

    const openCheckout = () => {
        if (!cart.length) {
            showToast('Add an item first');
        } else if (!orderOnly && !paymentMethods.length) {
            showToast('No payment methods are on at this branch');
        } else {
            setCheckoutOpen(true);
        }
    };

    const confirmAction = () => {
        if (confirm?.kind === 'void') {
            clearOrder();
        } else if (confirm?.kind === 'exit') {
            if (orderOnly) {
                router.visit(route('home'));
            } else {
                router.post(route('pos.lock'));
            }
        } else if (confirm?.kind === 'serve') {
            router.patch(
                route('pos.orders.status', confirm.order.id),
                { status: 'served' },
                { preserveScroll: true, onError: (errors) => showToast(firstError(errors)) },
            );
        }

        setConfirm(null);
    };

    const shownReceipt = receipt && receipt.id !== dismissedReceiptId ? receipt : null;

    if (props.backOffice) {
        return (
            <>
                <BackOffice
                    data={props.backOffice}
                    branchName={branch.name}
                    branchId={branch.id}
                    staffName={props.staff.name}
                    staffRole={props.staff.role}
                    toast={showToast}
                />
                <Toast message={toast} />
            </>
        );
    }

    return (
        <div className="bg-bg font-body text-text flex min-h-screen flex-col lg:h-screen">
            <TopBar
                branchName={branch.name}
                clock={clockLabel(now)}
                inbox={
                    orderOnly ? null : { waiting: props.inbox.filter((order) => order.status === 'sent').length, onOpen: () => setInboxOpen(true) }
                }
                screens={
                    orderOnly
                        ? []
                        : [
                              { value: 'till', label: 'Till' },
                              { value: 'queue', label: 'Queue', badge: queue.length },
                              ...(props.canManageBranch ? [{ value: 'inventory' as const, label: 'Inventory' }] : []),
                          ]
                }
                screen={screen}
                onScreen={(next) => (next === 'inventory' ? openBackOffice('dash') : setScreen(next))}
                printerName={printerName}
                onPrinter={togglePrinter}
                staffName={props.staff.name}
                onExit={() => setConfirm({ kind: 'exit' })}
            />

            {screen === 'queue' ? (
                <QueueBoard
                    orders={queue}
                    now={now}
                    onAdvance={advance}
                    onSettle={(order) => setSettling({ order, senior: order.senior })}
                    onPrintTicket={(order) => setPrintAsk({ kind: 'ticket', order })}
                />
            ) : (
                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                    <MenuBoard
                        categories={props.categories}
                        menu={menu}
                        categoryId={categoryId}
                        onCategory={(id) => {
                            setCategoryId(id);
                            setSearch('');
                        }}
                        search={search}
                        onSearch={setSearch}
                        inOrder={inOrder}
                        orderOnly={orderOnly}
                        onPick={pickItem}
                    />
                    <OrderPanel
                        orderOnly={orderOnly}
                        service={service}
                        onService={setService}
                        tickets={props.tickets}
                        ticket={ticket}
                        onTicket={setTicket}
                        openTickets={openTickets}
                        cart={cart}
                        onQty={changeQty}
                        nextOrderNo={props.nextOrderNo}
                        senior={senior}
                        onSenior={setSenior}
                        totals={totals}
                        onVoid={() => cart.length && setConfirm({ kind: 'void' })}
                        onCharge={openCheckout}
                    />
                </div>
            )}

            {modifierItem && (
                <ModifierSheet
                    item={modifierItem}
                    sizes={sizes}
                    milks={milks}
                    addons={addons}
                    orderOnly={orderOnly}
                    onCancel={() => setModifierItem(null)}
                    onAdd={({ size, milk, addons: picked, qty }) => addLine(modifierItem, size, milk, picked, qty)}
                />
            )}

            {checkoutOpen &&
                (orderOnly ? (
                    <SendSheet
                        context={`${serviceLabel} · Ticket ${pad2(ticket)} · ${itemsLabel}`}
                        cart={cart}
                        note={note}
                        onNote={setNote}
                        processing={processing}
                        onBack={() => setCheckoutOpen(false)}
                        onSend={send}
                    />
                ) : (
                    <PaymentSheet
                        context={`${serviceLabel} · Ticket ${pad2(ticket)} · ${itemsLabel}`}
                        gross={gross}
                        senior={senior}
                        methods={paymentMethods}
                        canOpenRestrictedTabs={props.canOpenRestrictedTabs}
                        note={{ value: note, onChange: setNote }}
                        processing={processing}
                        onBack={() => setCheckoutOpen(false)}
                        onMessage={showToast}
                        onSubmit={charge}
                    />
                ))}

            {settling && (
                <PaymentSheet
                    context={`Order #${settling.order.no} · ${settling.order.service} · Ticket ${pad2(settling.order.ticket)}${settling.order.tab_name ? ` · tab for ${settling.order.tab_name}` : ''}`}
                    gross={settling.order.gross ?? 0}
                    senior={settling.senior}
                    onSenior={(value) => setSettling({ ...settling, senior: value })}
                    methods={paymentMethods.filter((method) => method.kind !== 'tab')}
                    canOpenRestrictedTabs={props.canOpenRestrictedTabs}
                    processing={processing}
                    onBack={() => setSettling(null)}
                    onMessage={showToast}
                    onSubmit={settle}
                />
            )}

            {shownReceipt && (
                <ReceiptSheet
                    order={shownReceipt}
                    orderOnly={orderOnly}
                    onPrint={() => setPrintAsk({ kind: orderOnly ? 'slip' : 'receipt', order: shownReceipt })}
                    onClose={() => setDismissedReceiptId(shownReceipt.id)}
                />
            )}

            <ConfirmDialog
                open={confirm !== null}
                title={confirm?.kind === 'void' ? 'Void this order?' : confirm?.kind === 'serve' ? `Mark #${confirm.order.no} served?` : 'Exit?'}
                body={confirmBody(confirm, cart.length, orderOnly)}
                cancelLabel={confirm?.kind === 'exit' ? 'Stay signed in' : confirm?.kind === 'serve' ? 'Not yet' : 'Keep it'}
                confirmLabel={confirm?.kind === 'void' ? 'Void order' : confirm?.kind === 'serve' ? 'Mark served' : 'Exit'}
                onCancel={() => setConfirm(null)}
                onConfirm={confirmAction}
            />

            <ConfirmDialog
                open={printAsk !== null}
                title={printAsk?.kind === 'ticket' ? 'Print kitchen ticket?' : printAsk?.kind === 'slip' ? 'Print slip?' : 'Print receipt?'}
                body={
                    isPrinterConnected() && printerName
                        ? `Sends ESC/POS straight to ${printerName} and cuts.`
                        : 'Opens your printer dialog. Pick the receipt printer and print at 58mm.'
                }
                cancelLabel="Not now"
                confirmLabel="Print"
                onCancel={() => setPrintAsk(null)}
                onConfirm={() => {
                    if (printAsk) {
                        print(printAsk);
                    }

                    setPrintAsk(null);
                }}
            />

            {inboxOpen && (
                <InboxSheet
                    orders={props.inbox}
                    processing={processing}
                    onClose={() => setInboxOpen(false)}
                    onAccept={(order) =>
                        router.post(
                            route('pos.inbox.accept', order.id),
                            {},
                            {
                                ...visitOptions(() => showToast(`${order.no} accepted — it's on the queue`)),
                                preserveState: true,
                            },
                        )
                    }
                    onDecline={(order) =>
                        router.post(
                            route('pos.inbox.decline', order.id),
                            {},
                            {
                                ...visitOptions(() => showToast(`${order.no} declined · ${order.agent?.split(' ')[0] ?? 'the agent'} notified`)),
                                preserveState: true,
                            },
                        )
                    }
                />
            )}

            <Toast message={toast} />
        </div>
    );
}

function confirmBody(confirm: { kind: 'exit' | 'void' } | { kind: 'serve'; order: TillOrder } | null, cartLines: number, orderOnly: boolean): string {
    if (confirm?.kind === 'void') {
        return 'Everything on the pending ticket is removed.';
    }

    if (confirm?.kind === 'serve') {
        return confirm.order.unpaid ? 'It stays on the board until it is settled.' : 'It leaves the board and frees its ticket.';
    }

    if (cartLines) {
        return `The pending ticket has ${cartLines} unsent ${cartLines === 1 ? 'item' : 'items'}. Exiting clears it.`;
    }

    return orderOnly ? 'You’ll go back to your workspaces.' : 'You’ll need your PIN to get back in.';
}

/** The first ticket after `after` that isn't held by an open order, wrapping round to 01. */
function firstFreeTicket(tickets: number, open: number[], after: number): number {
    for (let step = 1; step <= tickets; step++) {
        const candidate = ((after + step - 1) % tickets) + 1;

        if (!open.includes(candidate)) {
            return candidate;
        }
    }

    return 1;
}

const clockLabel = (now: Date) => now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

/** The current time, refreshed every 15 seconds for the clock and the queue's "min ago". */
function useNow(): Date {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 15000);

        return () => clearInterval(timer);
    }, []);

    return now;
}
