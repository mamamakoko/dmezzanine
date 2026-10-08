import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { Sheet } from '@/components/till/sheet';
import { openScreen, stockTag, trim, type ScreenData } from '@/lib/inventory';
import { escapeHtml, printReport } from '@/lib/report';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Warehouse bars in terracotta, commissary in sage. */
const LOCATION_COLORS = ['bg-accent', 'bg-accent-2-700'];
const PRINT_COLORS = ['#c67139', '#56633f'];

const monthLabel = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const kFormat = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : trim(n));

/**
 * Operations today: what needs attention, stock value, and what each location delivered out in a month.
 */
export function Dashboard({ data, toast }: { data: ScreenData<'dash'>; toast: (message: string) => void }) {
    const [lowOpen, setLowOpen] = useState(false);
    const [onHandOpen, setOnHandOpen] = useState(false);
    const [locationFilter, setLocationFilter] = useState<number | 'all'>('all');
    const { send, processing } = useBackOfficeAction(toast);

    const locations = [data.locations.wh, data.locations.cm].filter((location) => location !== null);
    const thisMonth = data.today.slice(0, 7);
    const totalValue = data.onHand.reduce((sum, row) => sum + row.value, 0);
    const allAtWarehouse = data.low.every((item) => item.location === data.locations.wh?.name);

    const shown = data.delivered.filter((line) => locationFilter === 'all' || line.from_id === locationFilter);
    const bars = Object.values(
        shown.reduce<Record<string, { name: string; fromId: number; unit: string; qty: number }>>((sum, line) => {
            const key = `${line.from_id}|${line.name}`;
            sum[key] ??= { name: line.name, fromId: line.from_id, unit: line.unit, qty: 0 };
            sum[key].qty += line.qty;

            return sum;
        }, {}),
    ).sort((a, b) => b.qty - a.qty);
    const max = Math.max(1, ...bars.map((bar) => bar.qty));
    const transferCount = new Set(shown.map((line) => line.transfer_id)).size;
    const colorOf = (fromId: number) =>
        Math.max(
            0,
            locations.findIndex((location) => location.id === fromId),
        );
    const sub = `${bars.length} ${bars.length === 1 ? 'item' : 'items'} delivered across ${transferCount} ${transferCount === 1 ? 'transfer' : 'transfers'} · ${monthLabel(data.month)}`;
    const years = [0, 1, 2].map((back) => String(Number(thisMonth.slice(0, 4)) - back));

    const exportPdf = () => {
        if (!bars.length) {
            toast('Nothing delivered in this period to export');

            return;
        }

        printReport(
            'Delivered outbound by item',
            `D’ Mezzanine Cafe · ${sub}`,
            bars
                .map((bar) => {
                    const location = locations.find((candidate) => candidate.id === bar.fromId);

                    return `<div class="row"><div>${escapeHtml(bar.name)} <span class="muted">${escapeHtml(location?.name ?? '')}</span></div><div class="track"><span style="width:${((bar.qty / max) * 100).toFixed(1)}%;background:${PRINT_COLORS[colorOf(bar.fromId)]}"></span></div><div style="text-align:right">${escapeHtml(`${kFormat(bar.qty)} ${bar.unit}`)}</div></div>`;
                })
                .join(''),
        );
    };

    const segment = (on: boolean) =>
        cn(
            'min-h-8 cursor-pointer rounded-[3px] px-[11px] py-1.5 text-xs font-semibold whitespace-nowrap',
            on ? 'bg-neutral-900 text-neutral-100' : 'text-text/74 bg-transparent',
        );

    return (
        <div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                <button
                    type="button"
                    onClick={() => setLowOpen(true)}
                    className="border-accent-300 bg-accent-200 cursor-pointer rounded-md border px-[18px] pt-[18px] pb-4 text-left"
                >
                    <div className="text-accent-900 text-[11.5px] tracking-[.08em] uppercase">Low stock</div>
                    <div className="text-accent-900 mt-2 text-[27px] leading-[1.05] font-semibold tabular-nums">{data.low.length}</div>
                    <div className="text-accent-800 mt-1 text-[12.5px]">
                        {allAtWarehouse ? 'all at the warehouse' : 'across the warehouse and commissary'}
                    </div>
                </button>
                <button
                    type="button"
                    onClick={() => setOnHandOpen(true)}
                    className="border-divider bg-surface hover:border-accent-400 cursor-pointer rounded-md border px-[18px] pt-[18px] pb-4 text-left"
                >
                    <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Stock on hand</div>
                    <div className="mt-2 text-[27px] leading-[1.05] font-semibold tabular-nums">{peso(totalValue)}</div>
                    <div className="text-text/74 mt-1 text-[12.5px]">at cost</div>
                </button>
            </div>

            <div className="border-divider bg-surface mt-[22px] rounded-md border px-[18px] pt-4 pb-3">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                    <div className="min-w-[200px] flex-[1_1_220px]">
                        <h4 className="m-0 text-base">Delivered outbound by item</h4>
                        <div className="text-text/74 mt-[3px] text-[12.5px]">{sub}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="rounded-btn flex gap-1 bg-neutral-100 p-[3px]">
                            <button type="button" onClick={() => setLocationFilter('all')} className={segment(locationFilter === 'all')}>
                                All
                            </button>
                            {locations.map((location) => (
                                <button
                                    key={location.id}
                                    type="button"
                                    onClick={() => setLocationFilter(location.id)}
                                    className={segment(locationFilter === location.id)}
                                >
                                    {location.name.split(' ·')[0]}
                                </button>
                            ))}
                        </div>
                        <div className="rounded-btn flex items-center gap-1 bg-neutral-100 p-[3px]">
                            <button
                                type="button"
                                onClick={() => openScreen('dash', { month: thisMonth })}
                                className={segment(data.month === thisMonth)}
                            >
                                This month
                            </button>
                            <select
                                aria-label="Month"
                                value={data.month.slice(5, 7)}
                                onChange={(event) => openScreen('dash', { month: `${data.month.slice(0, 4)}-${event.target.value}` })}
                                className="border-divider bg-surface text-text rounded-[3px] border px-[7px] py-[5px] text-xs"
                            >
                                {MONTHS.map((name, index) => (
                                    <option key={name} value={String(index + 1).padStart(2, '0')}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            <select
                                aria-label="Year"
                                value={data.month.slice(0, 4)}
                                onChange={(event) => openScreen('dash', { month: `${event.target.value}-${data.month.slice(5, 7)}` })}
                                className="border-divider bg-surface text-text rounded-[3px] border px-[7px] py-[5px] text-xs"
                            >
                                {years.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={exportPdf}
                            className="border-divider bg-bg rounded-btn hover:border-accent hover:text-accent-800 min-h-9 cursor-pointer border px-[13px] py-[7px] text-xs font-semibold whitespace-nowrap"
                        >
                            Export PDF
                        </button>
                    </div>
                </div>
                <div className="mt-3 flex items-center gap-3.5">
                    {locations
                        .filter((location) => locationFilter === 'all' || locationFilter === location.id)
                        .map((location) => (
                            <div key={location.id} className="text-text/74 flex items-center gap-1.5 text-xs">
                                <span className={cn('size-2.5 rounded-[2px]', LOCATION_COLORS[colorOf(location.id)])} />
                                {location.name.split(' ·')[0]}
                            </div>
                        ))}
                </div>
                <div className="mt-3 flex max-h-[352px] flex-col gap-2 overflow-y-auto pr-1">
                    {bars.map((bar) => (
                        <div key={`${bar.fromId}-${bar.name}`} className="grid grid-cols-[minmax(110px,196px)_1fr_92px] items-center gap-3">
                            <div className="truncate text-[12.5px]">
                                {bar.name}{' '}
                                <span className="text-text/74 text-[11.5px]">
                                    {locations.find((location) => location.id === bar.fromId)?.name.split(' ·')[0]}
                                </span>
                            </div>
                            <div className="relative h-[13px] overflow-hidden rounded-[3px] bg-neutral-100">
                                <div
                                    className={cn(
                                        'motion-safe:animate-barin absolute inset-y-0 left-0 origin-left rounded-[3px]',
                                        LOCATION_COLORS[colorOf(bar.fromId)],
                                    )}
                                    style={{ width: `${((bar.qty / max) * 100).toFixed(1)}%` }}
                                />
                            </div>
                            <div className="text-right text-[12.5px] whitespace-nowrap tabular-nums">
                                {kFormat(bar.qty)} {bar.unit}
                            </div>
                        </div>
                    ))}
                    {bars.length === 0 && <div className="text-text/74 py-6 text-center text-[13px]">No delivered outbound transfers yet</div>}
                </div>
            </div>

            <Sheet
                open={lowOpen}
                onClose={() => setLowOpen(false)}
                title="Needs attention"
                width="max-w-[660px]"
                className="[&>h2]:bg-accent-100 [&>h2]:text-accent-900 flex flex-col overflow-hidden p-0 [&>h2]:px-[26px] [&>h2]:pt-[22px]"
            >
                <p className="bg-accent-100 text-accent-800 border-accent-200 m-0 border-b px-[26px] pt-1 pb-5 text-[13.5px]">
                    {data.low.length} {data.low.length === 1 ? 'item at or below par' : 'items at or below par'} across all locations
                </p>
                <div className="max-h-[56vh] flex-1 overflow-y-auto">
                    {locations.map((location) => {
                        const rows = data.low.filter((item) => item.location === location.name);

                        if (!rows.length) {
                            return null;
                        }

                        return (
                            <div key={location.id}>
                                <div className="border-divider sticky top-0 flex items-center gap-2.5 border-b bg-neutral-900 px-[26px] py-3 text-neutral-100">
                                    <span className="text-[13px] font-semibold tracking-[.09em] uppercase">{location.name}</span>
                                    <span className="bg-accent rounded-full px-[9px] py-[3px] text-[11.5px] whitespace-nowrap">
                                        {rows.length} below par
                                    </span>
                                </div>
                                {rows.map((item) => {
                                    const tag = stockTag(item);

                                    return (
                                        <div
                                            key={item.id}
                                            className="border-divider flex flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b px-[26px] py-3"
                                        >
                                            <div className="min-w-0 flex-[1_1_180px]">
                                                <div className="text-sm">{item.name}</div>
                                                <div className="text-text/74 text-[11.5px]">
                                                    {item.sku} · {item.supplier ?? 'No supplier'}
                                                </div>
                                            </div>
                                            <div className="flex-none text-[13px] whitespace-nowrap tabular-nums">
                                                <span className="font-semibold">
                                                    {trim(item.on_hand)} {item.unit}
                                                </span>{' '}
                                                <span className="text-[11.5px] opacity-50">/ {trim(item.par)} par</span>
                                            </div>
                                            <span
                                                className={cn(
                                                    'rounded-btn flex-none px-[9px] py-[3px] text-[11.5px] whitespace-nowrap',
                                                    tag.className,
                                                )}
                                            >
                                                {tag.label}
                                            </span>
                                            <button
                                                type="button"
                                                disabled={item.in_list || processing}
                                                onClick={() =>
                                                    send(
                                                        'post',
                                                        route('inventory.shopping.store'),
                                                        { warehouse_stock_id: item.id },
                                                        { success: `${item.name} added to shopping list` },
                                                    )
                                                }
                                                className={cn(
                                                    'rounded-btn min-h-9 flex-none cursor-pointer border px-3 py-1.5 text-[12.5px] whitespace-nowrap disabled:cursor-default',
                                                    item.in_list
                                                        ? 'border-divider text-text/74 bg-transparent'
                                                        : 'border-accent bg-accent text-neutral-100',
                                                )}
                                            >
                                                {item.in_list ? 'In list' : 'Add to list'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    {data.low.length === 0 && <div className="text-text/74 py-8 text-center text-[13px]">Everything is at or above par.</div>}
                </div>
                <div className="border-divider flex gap-2.5 border-t px-[26px] py-[18px]">
                    <button type="button" onClick={() => setLowOpen(false)} className="btn btn-secondary flex-1 p-[11px] text-[13.5px]">
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => openScreen('shop')}
                        className="btn btn-primary flex-1 p-3 text-sm font-semibold whitespace-nowrap"
                    >
                        Open shopping list
                    </button>
                </div>
            </Sheet>

            <Sheet open={onHandOpen} onClose={() => setOnHandOpen(false)} title={peso(totalValue)} width="max-w-[400px]">
                <div className="text-text/74 -mt-0.5 text-[12.5px]">Stock on hand at cost</div>
                <div className="mt-2">
                    {data.onHand.map((row) => (
                        <div key={row.name} className="border-divider flex items-baseline gap-3.5 border-b py-[13px]">
                            <div className="flex-1">
                                <div className="text-sm">{row.name}</div>
                                <div className="text-text/74 text-[11.5px]">
                                    {row.items} {row.items === 1 ? 'item tracked' : 'items tracked'}
                                </div>
                            </div>
                            <div className="text-[15px] font-semibold tabular-nums">{peso(row.value)}</div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-4">
                    <button type="button" onClick={() => setOnHandOpen(false)} className="btn btn-secondary px-5 py-2.5 text-[13.5px]">
                        Close
                    </button>
                </div>
            </Sheet>
        </div>
    );
}
