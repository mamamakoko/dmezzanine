import { Panel } from '@/components/till/back-office/ui';
import { openBackOffice, qtyLabel, type StockRow, type TabData } from '@/lib/back-office';
import { escapeHtml, printReport } from '@/lib/report';
import { pad2, peso } from '@/lib/till';
import { cn } from '@/lib/utils';

const barWidth = (row: StockRow) => `${Math.max(0, Math.min(100, (row.on_hand / (row.par || 1)) * 100)).toFixed(1)}%`;

/**
 * Today at the branch: stock health against par, today's sales, and what needs attention.
 */
export function DashboardTab({ data, branchName }: { data: TabData<'dash'>; branchName: string }) {
    const low = data.stock.filter((row) => row.low);
    const stockValue = data.stock.reduce((sum, row) => sum + row.cost * row.on_hand, 0);
    const unpaidTotal = data.unpaid.reduce((sum, order) => sum + order.total, 0);

    const stats = [
        {
            label: 'Below half par',
            value: String(low.length),
            sub: low.length ? 'raise a request' : 'all items healthy',
            alert: low.length > 0,
            tab: 'stock' as const,
        },
        {
            label: 'Sales today',
            value: peso(data.salesToday.total),
            sub: `${data.salesToday.count} ${data.salesToday.count === 1 ? 'receipt' : 'receipts'}`,
            alert: false,
            tab: 'sales' as const,
        },
        {
            label: 'Unpaid orders',
            value: String(data.unpaid.length),
            sub: data.unpaid.length ? `${peso(unpaidTotal)} to collect` : 'nothing open',
            alert: false,
            tab: 'sales' as const,
        },
        { label: 'Stock value', value: peso(stockValue), sub: 'at last cost', alert: false, tab: 'stock' as const },
    ];

    const exportPdf = () =>
        printReport(
            'Stock on hand against par',
            `${branchName} · ${new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}`,
            data.stock
                .map(
                    (row) =>
                        `<div class="row"><div>${escapeHtml(row.name)} <span class="muted">${escapeHtml(row.category)}</span></div><div class="track"><span style="width:${barWidth(row)};background:${row.low ? '#c67139' : '#56633f'}"></span></div><div class="n" style="text-align:right">${escapeHtml(`${+row.on_hand.toFixed(3)} / ${qtyLabel(row.par, row.unit)}`)}</div></div>`,
                )
                .join(''),
        );

    return (
        <div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
                {stats.map((stat) => (
                    <button
                        key={stat.label}
                        type="button"
                        onClick={() => openBackOffice(stat.tab)}
                        className={cn(
                            'cursor-pointer rounded-md border px-[18px] pt-[18px] pb-4 text-left',
                            stat.alert ? 'border-accent bg-accent-200' : 'border-divider hover:border-accent-400 bg-neutral-100',
                        )}
                    >
                        <div className={cn('text-[11.5px] tracking-[.08em] uppercase', stat.alert ? 'text-accent-900' : 'text-text/74')}>
                            {stat.label}
                        </div>
                        <div className="mt-2 text-[27px] leading-[1.05] font-semibold tabular-nums">{stat.value}</div>
                        <div className="text-text/74 mt-1 text-[12.5px]">{stat.sub}</div>
                    </button>
                ))}
            </div>

            <Panel className="mt-[22px] px-[18px] pt-4 pb-3.5">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                    <div className="min-w-[200px] flex-[1_1_220px]">
                        <h4 className="m-0 text-base">Stock on hand against par</h4>
                        <div className="text-text/74 mt-[3px] text-[12.5px]">
                            {data.stock.length} items tracked at {branchName}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={exportPdf}
                        className="border-divider bg-bg rounded-btn cursor-pointer border px-[13px] py-[7px] text-xs font-semibold whitespace-nowrap"
                    >
                        Export PDF
                    </button>
                </div>
                <div className="mt-3 flex items-center gap-3.5">
                    {[
                        ['Below half par', 'bg-accent'],
                        ['Healthy', 'bg-accent-2-700'],
                    ].map(([label, color]) => (
                        <div key={label} className="text-text/74 flex items-center gap-1.5 text-xs">
                            <span className={cn('size-2.5 rounded-[2px]', color)} />
                            {label}
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex max-h-[352px] flex-col gap-2 overflow-y-auto pr-1">
                    {data.stock.map((row) => (
                        <div key={row.id} className="grid grid-cols-[minmax(110px,196px)_1fr_108px] items-center gap-3">
                            <div className="truncate text-[12.5px]">
                                {row.name} <span className="text-text/74 text-[11.5px]">{row.category}</span>
                            </div>
                            <div className="bg-bg relative h-[13px] overflow-hidden rounded-[3px]">
                                <div
                                    className={cn('absolute inset-y-0 left-0 rounded-[3px]', row.low ? 'bg-accent' : 'bg-accent-2-700')}
                                    style={{ width: barWidth(row) }}
                                />
                            </div>
                            <div className="text-right text-[12.5px] whitespace-nowrap tabular-nums">
                                {+row.on_hand.toFixed(3)} / {qtyLabel(row.par, row.unit)}
                            </div>
                        </div>
                    ))}
                </div>
            </Panel>

            <Panel className="mt-3.5 px-[18px] py-4">
                <h4 className="m-0 mb-2.5 text-base">Needs attention</h4>
                {low.map((row) => (
                    <AttentionRow
                        key={`low-${row.id}`}
                        what={`${row.name} — ${qtyLabel(row.on_hand, row.unit)} left`}
                        meta={`${row.category} · par ${qtyLabel(row.par, row.unit)}`}
                        tag={row.on_hand <= 0 ? 'Out' : 'Low'}
                        action="Open stock"
                        onAction={() => openBackOffice('stock')}
                    />
                ))}
                {data.unpaid.map((order) => (
                    <AttentionRow
                        key={`unpaid-${order.id}`}
                        what={`#${order.no}${order.ticket ? ` · Ticket ${pad2(order.ticket)}` : ''} — ${peso(order.total)} unpaid`}
                        meta={order.label}
                        tag="Unpaid"
                        action="Open sales"
                        onAction={() => openBackOffice('sales')}
                        neutral
                    />
                ))}
                {low.length === 0 && data.unpaid.length === 0 && (
                    <div className="text-text/74 py-[22px] text-center text-[13px]">Nothing needs attention right now.</div>
                )}
            </Panel>
        </div>
    );
}

function AttentionRow({
    what,
    meta,
    tag,
    action,
    onAction,
    neutral = false,
}: {
    what: string;
    meta: string;
    tag: string;
    action: string;
    onAction: () => void;
    neutral?: boolean;
}) {
    return (
        <div className="border-divider flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b py-[11px] last:border-b-0">
            <div className="min-w-0 flex-[1_1_220px]">
                <div className="text-[13.5px]">{what}</div>
                <div className="text-text/74 text-[11.5px]">{meta}</div>
            </div>
            <span
                className={cn(
                    'rounded-btn px-2.5 py-1 text-[11.5px] whitespace-nowrap',
                    neutral ? 'bg-neutral-200 text-neutral-800' : 'bg-accent-200 text-accent-900',
                )}
            >
                {tag}
            </span>
            <button
                type="button"
                onClick={onAction}
                className="border-divider bg-bg rounded-btn cursor-pointer border px-[13px] py-[7px] text-[12.5px] whitespace-nowrap"
            >
                {action}
            </button>
        </div>
    );
}
