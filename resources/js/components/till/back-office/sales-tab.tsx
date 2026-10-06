import { Panel, SectionLabel, useBackOfficeAction } from '@/components/till/back-office/ui';
import { choiceClass, Sheet } from '@/components/till/sheet';
import { escapeHtml, openBackOffice, printReport, type Receipt, type TabData } from '@/lib/back-office';
import { orderTotals, pad2, peso, peso2 } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/** Peso amount with a real minus sign for refunds. */
const signed = (amount: number) => (amount < 0 ? `−${peso(-amount)}` : peso(amount));

const when = (iso: string) => {
    const date = new Date(iso);

    return `${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
};

const linesLeft = (receipt: Receipt) => receipt.lines.reduce((sum, line) => sum + line.qty - line.refunded, 0);

/**
 * Every sale and refund at the branch: totals, the split breakdown, unpaid orders, totals by payment
 * method, refunds and a PDF of the current view.
 */
export function SalesTab({ data, branchName, toast }: { data: TabData<'sales'>; branchName: string; toast: (message: string) => void }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState<number | null>(null);
    const [refunding, setRefunding] = useState<Receipt | null>(null);

    const terms = query.trim().toLowerCase();
    const shown = data.receipts.filter(
        (receipt) =>
            !terms ||
            `#${receipt.no} ${receipt.cashier ?? ''} ${receipt.service} ${receipt.method} ${receipt.tab_name ?? ''} ${receipt.lines.map((line) => line.name).join(' ')}`
                .toLowerCase()
                .includes(terms),
    );
    const paidShown = shown.filter((receipt) => !receipt.unpaid);
    const inView = paidShown.reduce((sum, receipt) => sum + receipt.total, 0);
    const itemsSold = shown
        .filter((receipt) => receipt.method !== 'Refund')
        .reduce((sum, receipt) => sum + receipt.lines.reduce((n, line) => n + line.qty, 0), 0);

    const byMethod = new Map<string, { amount: number; count: number }>();

    for (const receipt of shown) {
        const parts = receipt.unpaid ? [{ method: '(unpaid)', amount: receipt.total }] : receipt.payments;

        for (const part of parts) {
            const bucket = byMethod.get(part.method) ?? { amount: 0, count: 0 };
            byMethod.set(part.method, { amount: bucket.amount + part.amount, count: bucket.count + 1 });
        }
    }

    const methods = [...byMethod.entries()].sort((a, b) => b[1].amount - a[1].amount);
    const isToday = data.filters.from === data.today && data.filters.to === data.today;
    const allDates = !data.filters.from && !data.filters.to;
    const setDates = (from: string | null, to: string | null) => openBackOffice('sales', { ...(from ? { from } : {}), ...(to ? { to } : {}) });
    const range = allDates ? 'All dates' : `${data.filters.from ?? 'start'} to ${data.filters.to ?? 'today'}`;

    const stats = [
        {
            label: 'Sales today',
            value: peso(data.todayTotals.total),
            sub: `${data.todayTotals.count} ${data.todayTotals.count === 1 ? 'receipt' : 'receipts'}`,
        },
        { label: 'Average ticket', value: peso(data.todayTotals.count ? data.todayTotals.total / data.todayTotals.count : 0), sub: 'today' },
        { label: 'In this view', value: signed(inView), sub: `${paidShown.length} ${paidShown.length === 1 ? 'receipt' : 'receipts'}` },
        { label: 'Items sold', value: String(itemsSold), sub: 'in this view' },
    ];

    const exportPdf = () =>
        printReport(
            `Sales · ${branchName}`,
            `${range}${terms ? ` · matching “${query.trim()}”` : ''} · printed ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`,
            `<div class="totals">${stats
                .slice(2)
                .map((stat) => `<div><span class="muted">${escapeHtml(stat.label)}</span><b>${escapeHtml(stat.value)}</b></div>`)
                .join(
                    '',
                )}${methods.map(([method, total]) => `<div><span class="muted">${escapeHtml(method)}</span><b>${escapeHtml(signed(total.amount))}</b></div>`).join('')}</div>
<table><thead><tr><th>Receipt</th><th>When</th><th>Items</th><th>Payment</th><th>Cashier</th><th class="n">Total</th></tr></thead><tbody>${shown
                .map(
                    (receipt) =>
                        `<tr><td>#${receipt.no}${receipt.refund_of_no ? ` <span class="muted">refund of #${receipt.refund_of_no}</span>` : ''}</td><td>${escapeHtml(when(receipt.created_at))}</td><td>${escapeHtml(
                            receipt.lines.map((line) => `${line.qty}× ${line.name}`).join(', '),
                        )}</td><td>${escapeHtml(receipt.payments.length > 1 ? receipt.payments.map((p) => `${p.method} ${signed(p.amount)}`).join(' + ') : receipt.method)}</td><td>${escapeHtml(
                            receipt.cashier ?? '',
                        )}</td><td class="n">${escapeHtml(signed(receipt.total))}</td></tr>`,
                )
                .join('')}</tbody></table>`,
        );

    const dateButton = (on: boolean) =>
        cn(
            'rounded-btn cursor-pointer border px-[11px] py-1.5 text-[12.5px] whitespace-nowrap',
            on ? 'border-accent bg-accent text-neutral-100' : 'border-divider text-text bg-transparent',
        );

    return (
        <div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
                {stats.map((stat) => (
                    <Panel key={stat.label} className="px-[18px] py-4">
                        <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">{stat.label}</div>
                        <div className="mt-2 text-[26px] leading-[1.05] font-semibold tabular-nums">{stat.value}</div>
                        <div className="text-text/74 mt-1 text-[12.5px]">{stat.sub}</div>
                    </Panel>
                ))}
            </div>

            {data.unpaid.length > 0 && (
                <>
                    <SectionLabel className="mt-5">Unpaid · settle from the till’s queue</SectionLabel>
                    <div className="flex flex-wrap gap-2">
                        {data.unpaid.map((order) => (
                            <div
                                key={order.id}
                                className="border-accent-300 bg-accent-100 flex items-baseline gap-2.5 rounded-md border px-3.5 py-2.5"
                            >
                                <span className="text-[13.5px] font-semibold">
                                    #{order.no}
                                    {order.ticket ? ` · Ticket ${pad2(order.ticket)}` : ''}
                                </span>
                                <span className="text-[15px] font-semibold tabular-nums">{peso(order.total)}</span>
                                <span className="text-text/74 text-xs">{order.tab_name ? `tab for ${order.tab_name}` : 'from the Branch Menu'}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <SectionLabel className="mt-5">By payment method · this view</SectionLabel>
            <div className="flex flex-wrap gap-2">
                {methods.map(([method, total]) => (
                    <Panel key={method} className="flex items-baseline gap-2.5 px-3.5 py-2.5">
                        <span className="text-[13.5px] font-semibold">{method}</span>
                        <span className="text-[15px] font-semibold tabular-nums">{signed(total.amount)}</span>
                        <span className="text-text/74 text-xs">
                            {total.count} {total.count === 1 ? 'payment' : 'payments'}
                        </span>
                    </Panel>
                ))}
                {methods.length === 0 && <span className="text-text/74 text-[13px]">No payments in this view.</span>}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <input
                    className="input min-w-[180px] flex-[1_1_220px] text-[13px]"
                    placeholder="Search receipt no, item or cashier"
                    aria-label="Search sales"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-text/74 text-[11.5px] tracking-[.06em] uppercase">Date</span>
                    <button type="button" onClick={() => setDates(data.today, data.today)} className={dateButton(isToday)}>
                        Today
                    </button>
                    <input
                        type="date"
                        aria-label="From"
                        className="input px-[7px] py-[5px] text-xs"
                        value={data.filters.from ?? ''}
                        onChange={(event) => setDates(event.target.value || null, data.filters.to)}
                    />
                    <span className="text-text/74 text-xs">to</span>
                    <input
                        type="date"
                        aria-label="To"
                        className="input px-[7px] py-[5px] text-xs"
                        value={data.filters.to ?? ''}
                        onChange={(event) => setDates(data.filters.from, event.target.value || null)}
                    />
                    <button type="button" onClick={() => setDates(null, null)} className={dateButton(allDates)}>
                        All dates
                    </button>
                    <button
                        type="button"
                        onClick={exportPdf}
                        className="bg-accent rounded-btn cursor-pointer px-3.5 py-[7px] text-[12.5px] font-semibold whitespace-nowrap text-neutral-100"
                    >
                        Export PDF
                    </button>
                </div>
            </div>

            <Panel className="mt-3.5 overflow-hidden">
                <div className="border-divider bg-bg text-text/74 grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,130px)_104px_56px] gap-2.5 border-b px-[18px] py-[11px] text-[11px] font-bold tracking-[.1em] uppercase">
                    <div>Receipt</div>
                    <div>Items</div>
                    <div>Payment</div>
                    <div className="text-right">Total</div>
                    <div />
                </div>
                {shown.map((receipt) => {
                    const expanded = open === receipt.id;
                    const refunded = receipt.lines.reduce((sum, line) => sum + line.refunded, 0);
                    const canRefund = receipt.method !== 'Refund' && !receipt.unpaid && receipt.total > 0 && linesLeft(receipt) > 0;

                    return (
                        <div key={receipt.id} className="border-divider border-b last:border-b-0">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,130px)_104px_56px] items-center gap-2.5 px-[18px] py-3">
                                <div className="min-w-0">
                                    <div className="text-[13.5px] font-semibold">
                                        #{receipt.no}
                                        {receipt.refund_of_no && (
                                            <span className="text-accent-700 font-normal"> · refund of #{receipt.refund_of_no}</span>
                                        )}
                                    </div>
                                    <div className="text-text/74 text-[11.5px] tabular-nums">{when(receipt.created_at)}</div>
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[13px] text-pretty">
                                        {receipt.lines.map((line) => `${line.qty}× ${line.name}`).join(', ')}
                                    </div>
                                    <div className="text-text/74 text-[11.5px]">
                                        {receipt.service}
                                        {receipt.ticket ? ` · Ticket ${pad2(receipt.ticket)}` : ''}
                                        {receipt.refund_reason ? ` · ${receipt.refund_reason}` : ''}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <span
                                        className={cn(
                                            'rounded-btn inline-block px-2.5 py-1 text-[11.5px] whitespace-nowrap',
                                            receipt.method === 'Refund'
                                                ? 'bg-accent-300 text-accent-900'
                                                : receipt.unpaid
                                                  ? 'bg-accent-200 text-accent-900'
                                                  : receipt.method === 'Cash'
                                                    ? 'bg-accent-2-300 text-accent-2-900'
                                                    : 'bg-neutral-200 text-neutral-800',
                                        )}
                                    >
                                        {receipt.method}
                                    </span>
                                    {(receipt.payments.length > 1 || receipt.tab_name) && (
                                        <div className="text-text/74 mt-1 text-[11px] tabular-nums">
                                            {receipt.unpaid
                                                ? `Unpaid · ${receipt.tab_name}`
                                                : receipt.payments.map((part) => `${part.method} ${signed(part.amount)}`).join(' + ')}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right text-sm font-semibold tabular-nums">{signed(receipt.total)}</div>
                                <button
                                    type="button"
                                    aria-expanded={expanded}
                                    onClick={() => setOpen(expanded ? null : receipt.id)}
                                    className="border-divider bg-bg rounded-btn cursor-pointer justify-self-end border px-2.5 py-1.5 text-xs"
                                >
                                    {expanded ? 'Hide' : 'View'}
                                </button>
                            </div>
                            {expanded && (
                                <div className="border-divider bg-bg border-t px-[18px] pt-1.5 pb-3">
                                    {receipt.lines.map((line) => (
                                        <div key={line.id} className="flex items-center gap-3 py-[7px] text-[13px]">
                                            <span className="text-text/74 w-[34px] flex-none tabular-nums">{line.qty}×</span>
                                            <span className="min-w-0 flex-1">
                                                {line.name}
                                                {line.mods !== 'No changes' && <span className="text-text/74"> · {line.mods}</span>}
                                                {line.refunded > 0 && <span className="text-accent-700"> · {line.refunded} refunded</span>}
                                            </span>
                                            <span className="flex-none tabular-nums">{signed(line.line_total)}</span>
                                        </div>
                                    ))}
                                    <div className="border-divider text-text/74 mt-[5px] flex flex-wrap items-center gap-x-[18px] gap-y-1.5 border-t pt-[9px] text-xs">
                                        <span>Gross {signed(receipt.gross)}</span>
                                        {receipt.senior && <span>VAT exempt {signed(receipt.vat_exempt)}</span>}
                                        <span>Discount {signed(receipt.discount)}</span>
                                        <span>VAT {signed(receipt.vat)}</span>
                                        {receipt.cashier && <span>Cashier {receipt.cashier.split(' ')[0]}</span>}
                                        {refunded > 0 && (
                                            <span className="text-accent-700">
                                                {refunded} {refunded === 1 ? 'item' : 'items'} refunded
                                            </span>
                                        )}
                                        <div className="flex-1" />
                                        {canRefund && (
                                            <button
                                                type="button"
                                                onClick={() => setRefunding(receipt)}
                                                className="border-accent-600 text-accent-700 hover:bg-accent-200 rounded-btn min-h-9 cursor-pointer border bg-transparent px-4 py-2 text-[12.5px] font-semibold"
                                            >
                                                Refund items
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {shown.length === 0 && <div className="text-text/74 p-[34px] text-center text-[13.5px]">No sales match these filters.</div>}
                {data.receipts.length >= data.limit && (
                    <div className="text-text/74 border-divider border-t p-3 text-center text-xs">
                        Showing the latest {data.limit} receipts. Pick dates to see older ones.
                    </div>
                )}
            </Panel>

            {refunding && <RefundSheet receipt={refunding} data={data} toast={toast} onClose={() => setRefunding(null)} />}
        </div>
    );
}

function RefundSheet({
    receipt,
    data,
    toast,
    onClose,
}: {
    receipt: Receipt;
    data: TabData<'sales'>;
    toast: (message: string) => void;
    onClose: () => void;
}) {
    const { send, processing } = useBackOfficeAction(toast);
    const [picked, setPicked] = useState<Record<number, number>>({});
    const [reason, setReason] = useState(data.refundReasons[0]);
    const [method, setMethod] = useState(data.refundMethods[0]);
    const [pin, setPin] = useState('');

    const each = (line: Receipt['lines'][number]) => line.line_total / line.qty;
    const count = Object.values(picked).reduce((sum, qty) => sum + qty, 0);
    const gross = receipt.lines.reduce((sum, line) => sum + each(line) * (picked[line.id] ?? 0), 0);
    const total = orderTotals(gross, receipt.senior).total;

    const submit = () =>
        send(
            'post',
            route('pos.orders.refunds.store', receipt.id),
            {
                lines: Object.entries(picked)
                    .filter(([, qty]) => qty > 0)
                    .map(([id, qty]) => ({ order_line_id: Number(id), qty })),
                reason,
                method,
                pin,
            },
            { success: `Refund on #${receipt.no} approved`, onSuccess: onClose },
        );

    return (
        <Sheet
            open
            onClose={onClose}
            title={`Refund #${receipt.no}`}
            description="Tick the items to give back — a multi-quantity line refunds in full unless you change the count."
            width="max-w-[620px]"
        >
            <div className="mb-5 flex flex-col gap-2">
                {receipt.lines.map((line) => {
                    const left = line.qty - line.refunded;
                    const selected = picked[line.id] ?? 0;
                    const setQty = (qty: number) => setPicked((current) => ({ ...current, [line.id]: Math.max(0, Math.min(left, qty)) }));

                    return (
                        <div
                            key={line.id}
                            className={cn(
                                'flex items-center gap-3.5 rounded-[8px] border px-3.5 py-3',
                                selected ? 'border-accent bg-accent-200' : 'border-divider bg-neutral-100',
                                left === 0 && 'opacity-50',
                            )}
                        >
                            <input
                                type="checkbox"
                                aria-label={`Refund ${line.name}`}
                                disabled={left === 0}
                                checked={selected > 0}
                                onChange={() => setQty(selected > 0 ? 0 : left)}
                                className="accent-accent size-[22px] flex-none cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-[14.5px] font-semibold">{line.name}</div>
                                <div className="text-text/74 text-xs">
                                    {line.qty} sold at {peso(each(line))}
                                    {line.refunded ? ` · ${line.refunded} already refunded` : ''}
                                </div>
                            </div>
                            {selected > 0 && left > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        aria-label="One less"
                                        onClick={() => setQty(Math.max(1, selected - 1))}
                                        className="border-divider bg-bg size-9 cursor-pointer rounded-full border text-base"
                                    >
                                        −
                                    </button>
                                    <div className="min-w-9 text-center text-[15px] font-semibold tabular-nums">
                                        {selected} of {left}
                                    </div>
                                    <button
                                        type="button"
                                        aria-label="One more"
                                        onClick={() => setQty(selected + 1)}
                                        className="border-divider bg-bg size-9 cursor-pointer rounded-full border text-base"
                                    >
                                        +
                                    </button>
                                </div>
                            )}
                            <div className="min-w-20 text-right text-[14.5px] font-semibold tabular-nums">
                                {selected ? `−${peso(each(line) * selected)}` : peso(0)}
                            </div>
                        </div>
                    );
                })}
            </div>

            <SectionLabel>Reason</SectionLabel>
            <div className="mb-[18px] flex flex-wrap gap-2">
                {data.refundReasons.map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => setReason(option)}
                        className={choiceClass(reason === option) + ' min-h-10 px-4 text-[13px]'}
                    >
                        {option}
                    </button>
                ))}
            </div>

            <SectionLabel>Refund method</SectionLabel>
            <div className="mb-[18px] flex flex-wrap gap-2">
                {data.refundMethods.map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => setMethod(option)}
                        className={choiceClass(method === option) + ' min-h-10 px-4 text-[13px]'}
                    >
                        {option}
                    </button>
                ))}
            </div>

            <div className="field mb-[18px]">
                <label htmlFor="refund-pin">Manager PIN</label>
                <input
                    id="refund-pin"
                    className="input w-[140px] tracking-[.4em]"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                />
            </div>

            <div className="bg-surface mb-[18px] flex items-baseline justify-between rounded-md px-[18px] py-3.5">
                <span className="text-base font-semibold">
                    Refund total · {count} {count === 1 ? 'item' : 'items'}
                </span>
                <span className="text-accent-700 text-[26px] font-semibold tabular-nums">−{peso2(total)}</span>
            </div>

            <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary px-5 py-[13px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={processing || count === 0}
                    onClick={submit}
                    className="btn btn-primary px-6 py-[13px] font-semibold disabled:opacity-60"
                >
                    Approve refund
                </button>
            </div>
        </Sheet>
    );
}
