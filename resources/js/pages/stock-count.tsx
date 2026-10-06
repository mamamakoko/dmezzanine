import { NavHeading, NavItem, StockShell } from '@/components/stock/stock-shell';
import { Sheet } from '@/components/till/sheet';
import { useToast } from '@/hooks/use-toast';
import { longDay, parseCount, timeOf, trim, type SheetSummary, type StockBranch } from '@/lib/stock';
import { firstError } from '@/lib/till';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface CountItem {
    id: number;
    sku: string;
    name: string;
    unit: string;
    station: string | null;
    beginning: number | null;
    counted: number | null;
    used_today: number | null;
}

interface StockCountProps {
    branch: StockBranch | null;
    branches?: StockBranch[] | null;
    today?: string;
    stations?: { value: string; label: string }[];
    items?: CountItem[];
    sheet?: SheetSummary | null;
    previous?: { day: string; status: string; by: string | null } | null;
    history?: SheetSummary[];
}

const STATION_ICONS: Record<string, string> = { bar: '◔', kitchen: '▤', pastry: '○', chiller: '❄', dry_store: '▣', packaging: '▭' };

/**
 * The daily stock count: staff count each item at the branch's stations. Figures save as they are typed;
 * submitting locks the sheet for the manager's review in the Stock Report.
 */
export default function StockCount(props: StockCountProps) {
    if (props.branch === null) {
        return <NoBranch />;
    }

    return <CountSheet {...(props as Required<StockCountProps> & { branch: StockBranch })} />;
}

function CountSheet({ branch, branches, today, stations, items, sheet, previous, history }: Required<StockCountProps> & { branch: StockBranch }) {
    const usedItems = items.filter((item) => item.used_today);
    const [tab, setTab] = useState<'sheet' | 'history'>('sheet');
    const [station, setStation] = useState(usedItems.length ? 'used' : 'all');
    const [query, setQuery] = useState('');
    const [values, setValues] = useState<Record<number, string>>(() =>
        Object.fromEntries(items.map((item) => [item.id, item.counted === null ? '' : trim(item.counted)])),
    );
    const [ask, setAsk] = useState<'preview' | 'confirm' | null>(null);
    const [toast, showToast] = useToast();

    const locked = sheet !== null && sheet.status !== 'draft';
    const countOf = (item: CountItem) => parseCount(values[item.id] ?? '');
    const counted = items.filter((item) => countOf(item) !== null);
    const varied = counted.filter((item) => item.beginning !== null && Math.abs((countOf(item) ?? 0) - item.beginning) > 0.001);
    const inStation = (item: CountItem, key: string) => (key === 'all' ? true : key === 'used' ? !!item.used_today : item.station === key);
    const activeStation = station === 'used' && !usedItems.length ? 'all' : station;
    const stationItems = items.filter((item) => inStation(item, activeStation));
    const terms = query.trim().toLowerCase();
    const shown = terms ? stationItems.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(terms)) : stationItems;
    const stationName =
        activeStation === 'used'
            ? "Used in today's orders"
            : activeStation === 'all'
              ? 'All items'
              : (stations.find((s) => s.value === activeStation)?.label ?? 'All items');
    const tally = (key: string) =>
        `${items.filter((item) => inStation(item, key) && countOf(item) !== null).length}/${items.filter((item) => inStation(item, key)).length}`;

    const save = (item: CountItem) => {
        const next = countOf(item);

        if (locked || next === item.counted) {
            return;
        }

        router.put(
            route('count.lines.update', [branch.id, item.id]),
            { counted: next },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['items', 'sheet'],
                onError: (errors) => {
                    showToast(firstError(errors));
                    setValues((current) => ({ ...current, [item.id]: item.counted === null ? '' : trim(item.counted) }));
                },
            },
        );
    };

    const submit = () =>
        router.post(
            route('count.submit', branch.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setAsk(null);
                    showToast('Count submitted — sheet locked');
                },
                onError: (errors) => {
                    setAsk(null);
                    showToast(firstError(errors));
                },
            },
        );

    const nav = (
        <>
            <NavHeading>Count sheet</NavHeading>
            <NavItem label="Today's count" icon="☰" active={tab === 'sheet'} onClick={() => setTab('sheet')} />
            <NavItem label="Submitted counts" icon="◷" active={tab === 'history'} onClick={() => setTab('history')} />
            {tab === 'sheet' && (
                <>
                    <NavHeading>Stations</NavHeading>
                    {usedItems.length > 0 && (
                        <NavItem
                            label="Used today"
                            icon="✓"
                            count={tally('used')}
                            active={activeStation === 'used'}
                            onClick={() => setStation('used')}
                        />
                    )}
                    <NavItem label="All items" icon="☷" count={tally('all')} active={activeStation === 'all'} onClick={() => setStation('all')} />
                    {stations.map((option) => (
                        <NavItem
                            key={option.value}
                            label={option.label}
                            icon={STATION_ICONS[option.value]}
                            count={tally(option.value)}
                            active={activeStation === option.value}
                            onClick={() => setStation(option.value)}
                        />
                    ))}
                </>
            )}
        </>
    );

    return (
        <>
            <Head title="Stock count" />
            <StockShell
                appName="DMC Stock Count"
                kicker="Daily stock count"
                title={tab === 'history' ? 'Submitted counts' : `${stationName} · ${longDay(today)}`}
                branch={branch}
                branches={branches}
                onBranch={(id) => router.get(route('count'), { branch: id })}
                nav={nav}
                headerEnd={
                    tab === 'sheet' && (
                        <input
                            className="input w-[240px] print:hidden"
                            placeholder="Search item or SKU"
                            aria-label="Search items"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    )
                }
                exitBody={
                    locked
                        ? "Today's sheet is already submitted. You can come back at any time."
                        : counted.length
                          ? `${counted.length} ${counted.length === 1 ? 'item is' : 'items are'} counted and saved on today's sheet. Nothing is lost — but the sheet stays unsubmitted until someone comes back to finish it.`
                          : 'Nothing has been counted yet. You can come back at any time.'
                }
                toast={toast}
            >
                {tab === 'sheet' ? (
                    <div className="motion-safe:animate-tin">
                        <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1.5">
                            <div className="text-[15px] font-semibold">
                                {stationItems.filter((item) => countOf(item) !== null).length} of {stationItems.length}{' '}
                                {activeStation === 'all'
                                    ? 'items counted'
                                    : activeStation === 'used'
                                      ? "ingredients from today's orders counted"
                                      : `counted at ${stationName.toLowerCase()}`}
                            </div>
                            <div className="text-text/74 text-[13px]">
                                {varied.length
                                    ? `${varied.length} ${varied.length === 1 ? 'variance' : 'variances'} against beginning`
                                    : 'No variances so far'}
                            </div>
                        </div>
                        <div className="text-text/74 mt-1 text-[12.5px]">
                            {previous
                                ? `Beginning is the ending counted on ${longDay(previous.day)}${previous.by ? ` by ${previous.by}` : ''} (${previous.status.toLowerCase()}).`
                                : "No earlier count yet — beginning is the branch's on hand."}
                        </div>

                        {locked && (
                            <div className="bg-accent-2-200 border-accent-2-700 mt-4 rounded-md border px-[18px] py-3.5">
                                <div className="text-accent-2-900 text-sm font-semibold">Sheet submitted — read only</div>
                                <div className="text-accent-2-900 mt-0.5 text-[12.5px] opacity-85">
                                    Submitted by {sheet.by} at {timeOf(sheet.at)} · {sheet.counted} of {items.length} items · {sheet.status_label}
                                </div>
                            </div>
                        )}

                        <div className="bg-surface border-divider mt-4 overflow-hidden rounded-md border">
                            <div className="overflow-x-auto">
                                <div className="border-divider text-text/74 grid min-w-[460px] grid-cols-[minmax(130px,2fr)_54px_84px_104px_80px] gap-[9px] border-b bg-neutral-100 px-4 py-3 text-[11px] font-bold tracking-[.07em] uppercase">
                                    <div>Item</div>
                                    <div>Unit</div>
                                    <div className="text-right">Beginning</div>
                                    <div className="text-center">Ending</div>
                                    <div className="text-right">Usage</div>
                                </div>
                                {shown.map((item) => {
                                    const count = countOf(item);
                                    const base = item.beginning;
                                    const usage =
                                        count === null || base === null
                                            ? '—'
                                            : count === base
                                              ? 'none'
                                              : (count > base ? '+' : '') + trim(Math.abs(base - count));

                                    return (
                                        <div
                                            key={item.id}
                                            className="border-divider grid min-w-[460px] grid-cols-[minmax(130px,2fr)_54px_84px_104px_80px] items-center gap-[9px] border-b px-4 py-2.5"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-[13.5px]">{item.name}</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-text/74 text-[11px]">{item.sku}</span>
                                                    {item.used_today !== null && (
                                                        <span className="rounded-btn bg-accent-2-100 text-accent-2-900 inline-flex items-center px-[7px] py-0.5 text-[11px] font-semibold tabular-nums">
                                                            Orders used {trim(item.used_today)} {item.unit}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-text/74 text-[12.5px]">{item.unit}</div>
                                            <div className="text-text/74 text-right text-sm tabular-nums">{base === null ? '—' : trim(base)}</div>
                                            <div className="flex justify-center">
                                                <input
                                                    aria-label={`${item.name} ending count`}
                                                    inputMode="decimal"
                                                    placeholder="—"
                                                    disabled={locked}
                                                    value={values[item.id] ?? ''}
                                                    onChange={(event) =>
                                                        setValues((current) => ({
                                                            ...current,
                                                            [item.id]: event.target.value.replace(/[^0-9.]/g, ''),
                                                        }))
                                                    }
                                                    onBlur={() => save(item)}
                                                    onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                                                    className={cn(
                                                        'rounded-btn text-text focus:border-accent w-24 border px-1 py-1.5 text-center text-[14.5px] font-semibold tabular-nums outline-none',
                                                        count === null ? 'border-divider' : 'border-accent-2-700',
                                                        locked ? 'bg-neutral-200' : 'bg-bg',
                                                    )}
                                                />
                                            </div>
                                            <div
                                                className={cn(
                                                    'text-right text-[13.5px] font-semibold tabular-nums',
                                                    count === null
                                                        ? 'text-text/74'
                                                        : base !== null && count > base
                                                          ? 'text-accent-2-800'
                                                          : 'text-text',
                                                )}
                                            >
                                                {usage}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {shown.length === 0 && (
                                <div className="text-text/74 p-[34px] text-center text-[13.5px]">
                                    {terms ? `No item matches “${query.trim()}”.` : 'No items at this station.'}
                                </div>
                            )}
                        </div>

                        {!locked && (
                            <div className="sticky bottom-0 mt-[18px] flex flex-wrap items-center gap-4 rounded-md bg-neutral-900 px-5 py-[15px] text-neutral-100">
                                <div className="min-w-[180px] flex-1">
                                    <div className="text-[14.5px] font-semibold">
                                        {counted.length} of {items.length} items counted
                                    </div>
                                    <div className="text-[12.5px] opacity-70">
                                        {counted.length === items.length
                                            ? 'Everything is in — ready to submit'
                                            : `${items.length - counted.length} left blank will be recorded as not counted`}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => (counted.length ? setAsk('preview') : showToast('Count at least one item first'))}
                                    className="btn btn-primary px-[22px] py-3 text-sm"
                                >
                                    Submit count
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <History history={history} />
                )}
            </StockShell>

            <Sheet
                open={ask === 'preview'}
                onClose={() => setAsk(null)}
                title="Review today's count"
                description={`${counted.length} of ${items.length} items counted on ${branch.name}.`}
                width="max-w-[560px]"
            >
                <div className="border-divider text-text/74 grid grid-cols-[minmax(120px,2fr)_54px_76px_76px] gap-2.5 border-b py-[9px] text-[10.5px] font-bold tracking-[.07em] uppercase">
                    <div>Item</div>
                    <div>Unit</div>
                    <div className="text-right">Beginning</div>
                    <div className="text-right">Ending</div>
                </div>
                <div className="max-h-[46vh] overflow-y-auto">
                    {counted.map((item) => (
                        <div
                            key={item.id}
                            className="border-divider grid grid-cols-[minmax(120px,2fr)_54px_76px_76px] items-baseline gap-2.5 border-b py-[9px]"
                        >
                            <div className="truncate text-[13px]">{item.name}</div>
                            <div className="text-text/74 text-xs">{item.unit}</div>
                            <div className="text-text/74 text-right text-[13px] tabular-nums">
                                {item.beginning === null ? '—' : trim(item.beginning)}
                            </div>
                            <div className="text-right text-[13px] font-semibold tabular-nums">{trim(countOf(item) ?? 0)}</div>
                        </div>
                    ))}
                </div>
                {counted.length < items.length && (
                    <p className="text-text/74 mt-3 mb-0 text-[12.5px] text-pretty">
                        {items.length - counted.length} items left blank will be recorded as not counted.
                    </p>
                )}
                <div className="mt-[18px] flex gap-2.5">
                    <button type="button" onClick={() => setAsk(null)} className="btn btn-secondary flex-1 p-[11px] text-[13.5px]">
                        Keep counting
                    </button>
                    <button type="button" onClick={() => setAsk('confirm')} className="btn btn-primary flex-1 p-3 text-sm">
                        Looks right
                    </button>
                </div>
            </Sheet>

            <Sheet open={ask === 'confirm'} onClose={() => setAsk(null)} title="Submit and lock this sheet?" width="max-w-[420px]">
                <p className="mt-2 mb-1.5 text-[13.5px]">
                    {counted.length} of {items.length} items counted on {branch.name}.
                </p>
                <p className="text-text/74 mt-0 mb-[22px] text-[12.5px] text-pretty">
                    Once submitted the sheet locks and the manager reviews it in the Stock Report. This can't be undone at the branch.
                </p>
                <div className="flex gap-2.5">
                    <button type="button" onClick={() => setAsk('preview')} className="btn btn-secondary flex-1 p-[11px] text-[13.5px]">
                        Back to review
                    </button>
                    <button type="button" onClick={submit} className="btn btn-primary flex-1 p-3 text-sm">
                        Submit count
                    </button>
                </div>
            </Sheet>
        </>
    );
}

function History({ history }: { history: SheetSummary[] }) {
    return (
        <div className="bg-surface border-divider motion-safe:animate-tin overflow-x-auto rounded-md border">
            <div className="text-text/74 grid min-w-[520px] grid-cols-[minmax(96px,1fr)_minmax(104px,1.1fr)_72px_minmax(120px,1fr)] gap-2.5 bg-neutral-100 px-[18px] py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                <div>Date</div>
                <div>Submitted by</div>
                <div className="text-right">Items</div>
                <div className="text-right">Review</div>
            </div>
            {history.map((count) => (
                <div
                    key={count.id}
                    className="border-divider grid min-w-[520px] grid-cols-[minmax(96px,1fr)_minmax(104px,1.1fr)_72px_minmax(120px,1fr)] items-center gap-2.5 border-t px-[18px] py-[13px]"
                >
                    <div className="text-[13.5px]">{longDay(count.day)}</div>
                    <div className="text-text/74 text-[13px]">
                        {count.by} · {timeOf(count.at)}
                    </div>
                    <div className="text-right text-[13px]">{count.counted}</div>
                    <div
                        className={cn(
                            'text-right text-[13px]',
                            count.status === 'returned' ? 'text-accent-800' : count.status === 'approved' ? 'text-accent-2-800' : 'text-text/74',
                        )}
                    >
                        {count.status_label}
                        {count.flagged ? ` · ${count.flagged} flagged` : ''}
                    </div>
                </div>
            ))}
            {history.length === 0 && <div className="text-text/74 p-[34px] text-center text-[13.5px]">No counts submitted for this branch yet.</div>}
        </div>
    );
}

function NoBranch() {
    return (
        <>
            <Head title="Stock count" />
            <div className="font-body flex min-h-screen flex-col items-start justify-center gap-3 bg-neutral-900 px-4 text-neutral-100 sm:px-[52px]">
                <div className="text-gold text-[11px] tracking-[.16em] uppercase">Stock count</div>
                <h1 className="m-0 text-[32px] leading-[1.12]">No branch on this account</h1>
                <p className="m-0 max-w-[40ch] text-sm text-neutral-100/66">
                    Counts are kept per branch. Ask the owner to assign your account to one.
                </p>
                <Link href={route('home')} className="text-gold mt-4 text-sm">
                    ← Back to workspaces
                </Link>
            </div>
        </>
    );
}
