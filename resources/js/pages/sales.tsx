import { NavHeading, NavItem, StockShell } from '@/components/stock/stock-shell';
import {
    barLabel,
    compactPeso,
    dayLabel,
    dayShort,
    exportSalesPdf,
    PERIOD_LABELS,
    rangeText,
    signedPeso,
    type Period,
    type SalesProps,
} from '@/lib/sales';
import { peso, peso2 } from '@/lib/till';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';

type Tab = 'overview' | 'vat';

type Filters = SalesProps['filters'];

/**
 * Sales reporting: takings per day, by category, payment method and item, per branch, and the VAT
 * summary, for a period or a date range, with a printable PDF.
 */
export default function Sales(props: SalesProps) {
    const { filters, report, branches } = props;
    const [tab, setTab] = useState<Tab>('overview');
    const [hoverDay, setHoverDay] = useState<string | null>(null);
    const { totals } = report;
    const custom = Boolean(filters.from || filters.to);
    const range = `${rangeText(props)} · ${props.branch?.name ?? 'All branches'}`;
    const recorded = report.days.filter((day) => day.tx > 0 || day.gross !== 0);

    const visit = (next: Partial<Filters>) => {
        const merged = { ...filters, ...next };

        router.get(
            route('sales'),
            {
                period: merged.period,
                from: merged.from || undefined,
                to: merged.to || undefined,
                branch: merged.branch ?? undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const focusDay = (date: string) => visit({ from: date, to: date });

    const nav = (
        <>
            <NavHeading>Sales</NavHeading>
            <NavItem label="Overview" icon="▦" active={tab === 'overview'} onClick={() => setTab('overview')} />
            <NavItem label="VAT summary" icon="▥" active={tab === 'vat'} onClick={() => setTab('vat')} />
        </>
    );

    const headerEnd = (
        <div className="flex flex-auto flex-wrap items-center justify-end gap-2.5">
            <div className="rounded-btn border-divider bg-surface flex gap-[3px] border p-[3px]">
                {(Object.keys(PERIOD_LABELS) as Period[]).map((period) => {
                    const on = !custom && filters.period === period;

                    return (
                        <button
                            key={period}
                            type="button"
                            aria-pressed={on}
                            onClick={() => visit({ period, from: null, to: null })}
                            className={cn(
                                'rounded-btn min-h-9 cursor-pointer px-[13px] py-[7px] text-[12.5px] font-semibold whitespace-nowrap',
                                on ? 'bg-accent text-neutral-100' : 'text-text bg-transparent',
                            )}
                        >
                            {PERIOD_LABELS[period]}
                        </button>
                    );
                })}
            </div>
            <div className="flex items-center gap-[5px]">
                <input
                    type="date"
                    aria-label="From"
                    value={filters.from ?? ''}
                    max={props.today}
                    onChange={(event) => visit({ from: event.target.value || null })}
                    className="rounded-btn border-divider bg-surface text-text min-h-9 border px-2 py-[7px] text-[12.5px]"
                />
                <span className="text-text/74 text-xs">to</span>
                <input
                    type="date"
                    aria-label="To"
                    value={filters.to ?? ''}
                    max={props.today}
                    onChange={(event) => visit({ to: event.target.value || null })}
                    className="rounded-btn border-divider bg-surface text-text min-h-9 border px-2 py-[7px] text-[12.5px]"
                />
                {custom && (
                    <button
                        type="button"
                        onClick={() => visit({ from: null, to: null })}
                        className="rounded-btn border-divider bg-surface text-text/74 inline-flex min-h-9 cursor-pointer items-center border px-2.5 py-[7px] text-[12.5px]"
                    >
                        Clear
                    </button>
                )}
            </div>
            {branches ? (
                <select
                    aria-label="Branch"
                    value={filters.branch ?? ''}
                    onChange={(event) => visit({ branch: event.target.value ? Number(event.target.value) : null })}
                    className="input min-h-9 w-[190px] max-w-full cursor-pointer"
                >
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                            {branch.name}
                        </option>
                    ))}
                </select>
            ) : (
                <span className="rounded-btn border-divider bg-surface border px-3 py-2 text-[12.5px] font-semibold">{props.branch?.name}</span>
            )}
            <button
                type="button"
                onClick={() => exportSalesPdf(props)}
                className="rounded-btn border-divider bg-surface hover:border-accent min-h-9 cursor-pointer border px-3.5 py-[9px] text-[12.5px] font-semibold whitespace-nowrap"
            >
                Export PDF
            </button>
        </div>
    );

    return (
        <>
            <Head title="Sales" />
            <StockShell
                appName="DMC Sales"
                kicker="Sales"
                title={tab === 'vat' ? 'VAT summary' : 'Sales overview'}
                nav={nav}
                headerEnd={headerEnd}
                exitBody="You'll go back to the workspace picker. You stay signed in."
                toast=""
            >
                {tab === 'overview' ? (
                    <div className="motion-safe:animate-tin">
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                            <Stat
                                tone="accent"
                                label="Total sales"
                                value={peso(totals.gross)}
                                sub={`${totals.tx} transactions · ${peso(totals.total)} collected`}
                            />
                            <Stat label="Average ticket" value={peso2(totals.tx ? totals.total / totals.tx : 0)} sub="per transaction" />
                            <Stat label="Amount net of VAT" value={peso(totals.net)} sub={`VAT ${peso(totals.vat)}`} />
                            <Stat label="Senior / PWD" value={peso(totals.discount)} sub="discount given" />
                        </div>

                        <Card className="mt-5 pb-3.5">
                            <div className="flex flex-wrap items-baseline gap-3">
                                <div className="text-[15.5px] font-semibold">Sales per day</div>
                                <div className="text-text/74 text-[12.5px]">{range}</div>
                            </div>
                            {recorded.length ? (
                                <>
                                    <DayChart days={report.days} hoverDay={hoverDay} onHover={setHoverDay} onFocus={focusDay} />
                                    <div className="border-divider mt-[18px] overflow-x-auto border-t">
                                        <div className="text-text/74 grid min-w-[560px] grid-cols-[minmax(120px,1.4fr)_82px_110px_110px_110px] gap-2.5 pt-[11px] pb-[9px] text-[11px] font-bold tracking-[.07em] uppercase">
                                            <div>Day</div>
                                            <div className="text-right">Orders</div>
                                            <div className="text-right">Sales</div>
                                            <div className="text-right">Net of VAT</div>
                                            <div className="text-right">Avg ticket</div>
                                        </div>
                                        {[...recorded].reverse().map((day) => (
                                            <button
                                                key={day.date}
                                                type="button"
                                                title="View this day only"
                                                onClick={() => focusDay(day.date)}
                                                className="border-divider grid w-full min-w-[560px] cursor-pointer grid-cols-[minmax(120px,1.4fr)_82px_110px_110px_110px] items-center gap-2.5 border-t py-[9px] text-left hover:bg-neutral-100"
                                            >
                                                <div className="text-[13.5px]">{dayLabel(day.date)}</div>
                                                <div className="text-text/74 text-right text-[13px]">{day.tx}</div>
                                                <div className="text-right text-[13.5px] font-semibold">{peso(day.total)}</div>
                                                <div className="text-text/74 text-right text-[13px]">{peso(day.net)}</div>
                                                <div className="text-text/74 text-right text-[13px]">{peso2(day.tx ? day.total / day.tx : 0)}</div>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <Empty />
                            )}
                        </Card>

                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <Card>
                                <div className="mb-3.5 text-[15.5px] font-semibold">Sales by category</div>
                                <Bars rows={report.categories.map((entry) => ({ ...entry, key: entry.name }))} fill="bg-accent" />
                                {report.categories.length === 0 && <Empty />}
                            </Card>
                            <Card>
                                <div className="mb-3.5 text-[15.5px] font-semibold">Payment method</div>
                                <Bars rows={report.methods.map((entry) => ({ ...entry, key: entry.name }))} fill="bg-accent-2-700" />
                                {report.methods.length === 0 && <Empty />}
                            </Card>
                        </div>

                        <Card className="mt-4">
                            <div className="mb-3.5 flex flex-wrap items-baseline gap-3">
                                <div className="text-[15.5px] font-semibold">Sales by item</div>
                                <div className="text-text/74 text-[12.5px]">{range}</div>
                            </div>
                            <Bars
                                rows={report.items
                                    .slice(0, 8)
                                    .map((item) => ({ key: item.name, name: item.name, amount: item.amount, qty: item.qty }))}
                                fill="bg-accent"
                            />
                            {report.items.length === 0 && <Empty />}
                        </Card>

                        <div className="border-divider bg-surface mt-4 overflow-x-auto rounded-md border">
                            <div className="text-text/74 grid min-w-[480px] grid-cols-[minmax(160px,2fr)_110px_130px_130px] gap-2.5 bg-neutral-100 px-[18px] py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                                <div>Branch</div>
                                <div className="text-right">Transactions</div>
                                <div className="text-right">Average ticket</div>
                                <div className="text-right">Sales</div>
                            </div>
                            {report.branches.map((branch) => (
                                <div
                                    key={branch.id}
                                    className="border-divider grid min-w-[480px] grid-cols-[minmax(160px,2fr)_110px_130px_130px] items-center gap-2.5 border-t px-[18px] py-[13px]"
                                >
                                    <div className="text-sm">{branch.name}</div>
                                    <div className="text-right text-[13px]">{branch.tx}</div>
                                    <div className="text-right text-[13px]">{peso2(branch.tx ? branch.total / branch.tx : 0)}</div>
                                    <div className="text-right text-[13.5px] font-semibold">{peso(branch.total)}</div>
                                </div>
                            ))}
                            {report.branches.length === 0 && (
                                <div className="border-divider text-text/74 border-t px-[18px] py-[13px] text-[13px]">
                                    No sales recorded in this period.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <VatSummary props={props} range={range} />
                )}
            </StockShell>
        </>
    );
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
    return <div className={cn('border-divider bg-surface rounded-md border px-5 py-[18px]', className)}>{children}</div>;
}

function Empty() {
    return <div className="text-text/74 py-[26px] text-center text-[13.5px]">No sales recorded in this period.</div>;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'accent' }) {
    const accent = tone === 'accent';

    return (
        <div className={cn('rounded-md border px-[18px] pt-[18px] pb-4', accent ? 'border-accent-600 bg-accent-200' : 'border-divider bg-surface')}>
            <div className={cn('text-[11.5px] tracking-[.08em] uppercase', accent ? 'text-accent-900' : 'text-text/74')}>{label}</div>
            <div className={cn('mt-2 text-[26px] leading-[1.05] font-semibold', accent ? 'text-accent-900' : 'text-text')}>{value}</div>
            <div className={cn('mt-1 text-[12.5px]', accent ? 'text-accent-800' : 'text-text/74')}>{sub}</div>
        </div>
    );
}

/**
 * Horizontal bars, each scaled to the largest. Refunds can make an entry negative; its bar shows the size.
 */
function Bars({ rows, fill }: { rows: { key: string; name: string; amount: number; qty?: number }[]; fill: string }) {
    const max = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);
    const withQty = rows.some((row) => row.qty !== undefined);

    return rows.map((row) => (
        <div
            key={row.key}
            className={cn(
                'grid items-center gap-3 py-[7px]',
                withQty ? 'grid-cols-[minmax(120px,1.4fr)_1fr_56px_92px]' : 'grid-cols-[minmax(90px,1.1fr)_1fr_86px]',
            )}
        >
            <div className="truncate text-[13px]">{row.name}</div>
            <div className="h-[9px] overflow-hidden rounded-full bg-neutral-200">
                <div className={cn('h-full rounded-full', fill)} style={{ width: `${Math.round((Math.abs(row.amount) / max) * 100)}%` }} />
            </div>
            {withQty && <div className="text-text/74 text-right text-[12.5px]">{row.qty}×</div>}
            <div className="text-right text-[13px]">{signedPeso(row.amount)}</div>
        </div>
    ));
}

/**
 * Takings per day as columns, with a value axis. Hovering a day shows its takings; clicking one shows
 * that day only.
 */
function DayChart({
    days,
    hoverDay,
    onHover,
    onFocus,
}: {
    days: SalesProps['report']['days'];
    hoverDay: string | null;
    onHover: (date: string | null) => void;
    onFocus: (date: string) => void;
}) {
    const max = Math.max(...days.map((day) => day.total), 1);

    return (
        <div className="mt-[18px] flex items-end gap-1.5">
            <div className="border-divider flex flex-none flex-col items-end gap-1.5 border-r pr-2">
                <div className="h-[15px]" />
                <div className="text-text/74 flex h-[140px] flex-col items-end justify-between text-[10.5px]">
                    {[3, 2, 1, 0].map((step) => (
                        <div key={step} className="leading-none whitespace-nowrap">
                            {compactPeso((max / 3) * step)}
                        </div>
                    ))}
                </div>
                <div className="h-[13px]" />
            </div>
            {days.map((day) => {
                const hovered = hoverDay === day.date;

                return (
                    <button
                        key={day.date}
                        type="button"
                        title={`${dayShort(day.date)} · view this day only`}
                        onMouseEnter={() => onHover(day.date)}
                        onMouseLeave={() => onHover(null)}
                        onFocus={() => onHover(day.date)}
                        onBlur={() => onHover(null)}
                        onClick={() => onFocus(day.date)}
                        className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 bg-transparent"
                    >
                        <div className={cn('h-[15px] text-[11px] leading-[15px] font-semibold whitespace-nowrap', hovered ? 'visible' : 'invisible')}>
                            {compactPeso(day.total)}
                        </div>
                        <div className="flex h-[140px] w-full items-end bg-[repeating-linear-gradient(to_top,var(--color-divider)_0_1px,transparent_1px_46.66px)]">
                            <div
                                className={cn(
                                    'min-h-0.5 w-full rounded-t-[4px]',
                                    hovered ? 'bg-accent-700' : day.total === max ? 'bg-accent' : 'bg-accent-400',
                                )}
                                style={{ height: `${Math.max(1.5, Math.round((Math.max(day.total, 0) / max) * 100))}%` }}
                            />
                        </div>
                        <div className="text-text/74 text-[11px] whitespace-nowrap">{barLabel(day.date, days.length)}</div>
                    </button>
                );
            })}
        </div>
    );
}

function VatSummary({ props, range }: { props: SalesProps; range: string }) {
    const { totals, days } = props.report;
    const lines: [string, string][] = [
        ['Total sales', peso2(totals.gross)],
        ['Amount net of VAT', peso2(totals.net)],
        ['Add VAT 12%', peso2(totals.vat)],
        ['VAT exempt (senior/PWD)', `−${peso2(totals.vat_exempt)}`],
        ['Less 20% discount', `−${peso2(totals.discount)}`],
    ];
    const recorded = days.filter((day) => day.tx > 0 || day.gross !== 0).reverse();

    return (
        <div className="motion-safe:animate-tin flex flex-wrap items-start gap-4">
            <div className="min-w-[280px] flex-[0_1_320px] rounded-md bg-neutral-900 px-5 py-[18px] text-neutral-100">
                <div className="text-[11.5px] tracking-[.08em] uppercase opacity-85">VAT summary</div>
                <div className="mt-0.5 text-[12.5px] opacity-70">{range}</div>
                <div className="my-4 h-px bg-white/14" />
                {lines.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3.5 py-1.5 text-[13.5px]">
                        <span className="opacity-78">{label}</span>
                        <span>{value}</span>
                    </div>
                ))}
                <div className="my-3.5 h-px bg-white/14" />
                <div className="flex items-baseline justify-between">
                    <span className="text-[13.5px]">Total amount due</span>
                    <span className="text-[22px] font-semibold">{peso2(totals.total)}</span>
                </div>
            </div>

            <div className="border-divider bg-surface min-w-0 flex-[1_1_420px] overflow-x-auto rounded-md border">
                <div className="text-text/74 grid min-w-[420px] grid-cols-[minmax(86px,1fr)_repeat(4,minmax(74px,1fr))] gap-2 bg-neutral-100 px-3.5 py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                    <div>Day</div>
                    <div className="text-right">Total sales</div>
                    <div className="text-right">Net of VAT</div>
                    <div className="text-right">VAT 12%</div>
                    <div className="text-right">Senior disc.</div>
                </div>
                {recorded.map((day) => (
                    <div
                        key={day.date}
                        className="border-divider grid min-w-[420px] grid-cols-[minmax(86px,1fr)_repeat(4,minmax(74px,1fr))] gap-2 border-t px-3.5 py-3"
                    >
                        <div className="text-[13.5px]">{dayShort(day.date)}</div>
                        <div className="text-right text-[13px]">{peso2(day.gross)}</div>
                        <div className="text-right text-[13px]">{peso2(day.net)}</div>
                        <div className="text-right text-[13px]">{peso2(day.vat)}</div>
                        <div className="text-accent-800 text-right text-[13px]">{day.discount ? `−${peso2(day.discount)}` : '—'}</div>
                    </div>
                ))}
                {recorded.length === 0 && (
                    <div className="border-divider text-text/74 border-t px-3.5 py-3 text-[13px]">No sales recorded in this period.</div>
                )}
            </div>
        </div>
    );
}
