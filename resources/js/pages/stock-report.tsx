import { NavHeading, StockShell } from '@/components/stock/stock-shell';
import { useToast } from '@/hooks/use-toast';
import { escapeHtml, printReport } from '@/lib/report';
import {
    longDay,
    longMonth,
    parseCount,
    shortDay,
    signed,
    stamp,
    trim,
    type ReviewRow,
    type SalesRow,
    type SheetStatus,
    type SheetSummary,
    type StockBranch,
} from '@/lib/stock';
import { firstError, peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

interface DayReport {
    sheet: SheetSummary;
    since: string;
    rows: ReviewRow[];
    sales: SalesRow[];
}

interface MonthReport {
    month: string;
    review: { status: SheetStatus; status_label: string; by: string | null; role: string | null; at: string | null } | null;
    rows: ReviewRow[];
    series: Record<number, { day: string; ending: number }[]>;
    sales: SalesRow[];
    sheets: SheetSummary[];
}

interface StockReportProps {
    branch: StockBranch | null;
    branches?: StockBranch[] | null;
    view?: 'day' | 'month';
    canSign?: boolean;
    tolerance?: number;
    days?: { day: string; status: SheetStatus }[];
    months?: string[];
    dayReport?: DayReport | null;
    monthReport?: MonthReport | null;
}

type Ready = Required<StockReportProps> & { branch: StockBranch };

/** What the review sends: a corrected ending, a mark, a note, or a month sign-off status. */
type ReviewChanges = Record<string, string | number | null>;

/**
 * The manager's review of submitted count sheets: counted usage against what sales predict, item by item.
 * Approving a day posts its endings as the branch's on hand, which the till shows.
 */
export default function StockReport(props: StockReportProps) {
    if (props.branch === null) {
        return (
            <>
                <Head title="Stock report" />
                <div className="font-body flex min-h-screen flex-col items-start justify-center gap-3 bg-neutral-900 px-4 text-neutral-100 sm:px-[52px]">
                    <div className="text-gold text-[11px] tracking-[.16em] uppercase">Stock report</div>
                    <h1 className="m-0 text-[32px] leading-[1.12]">No branch on this account</h1>
                    <Link href={route('home')} className="text-gold mt-4 text-sm">
                        ← Back to workspaces
                    </Link>
                </div>
            </>
        );
    }

    return <Report {...(props as Ready)} />;
}

function Report({ branch, branches, view, canSign, tolerance, days, months, dayReport, monthReport }: Ready) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<'gap' | 'name'>('gap');
    const [offOnly, setOffOnly] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [toast, showToast] = useToast();

    const isDay = view === 'day';
    const go = (params: Record<string, string | number | undefined>) =>
        router.get(
            route('report'),
            { branch: branch.id, view, day: dayReport?.sheet.day, month: monthReport?.month, ...params },
            { preserveState: true, preserveScroll: true },
        );
    const act = (method: 'post' | 'patch' | 'put', url: string, data: ReviewChanges = {}, success?: string) =>
        router[method](url, data, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => success && showToast(success),
            onError: (errors) => showToast(firstError(errors)),
        });

    const allRows = (isDay ? dayReport?.rows : monthReport?.rows) ?? [];
    const terms = query.trim().toLowerCase();
    const rows = allRows
        .filter((row) => (!terms || `${row.name} ${row.sku}`.toLowerCase().includes(terms)) && (!offOnly || row.off))
        .sort((a, b) => (sort === 'gap' ? Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0) : 0) || a.name.localeCompare(b.name));
    const offRows = allRows.filter((row) => row.off);
    const exposure = offRows.reduce((sum, row) => sum + Math.abs(row.value ?? 0), 0);
    const worst = [...allRows].sort((a, b) => Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0))[0];
    const checked = allRows.filter((row) => row.mark).length;
    const flagged = allRows.filter((row) => row.mark === 'flag').length;

    const sheet = dayReport?.sheet;
    const dayEditable = canSign && sheet?.status === 'submitted';
    const signStatus: SheetStatus | null = isDay ? (sheet?.status ?? null) : (monthReport?.review?.status ?? null);
    const signed_ = signStatus === 'approved' || signStatus === 'returned';
    const statusText = signed_
        ? signStatus === 'approved'
            ? 'Approved'
            : 'Returned for re-count'
        : isDay && checked
          ? `${checked} of ${allRows.length} checked`
          : 'Awaiting review';
    const gapPhrase = (row?: ReviewRow) => (row && row.gap !== null ? `${signed(row.gap)} ${row.unit} against sales` : 'nothing to compare yet');
    const pct = Math.round(tolerance * 100);
    const sales = (isDay ? dayReport?.sales : monthReport?.sales) ?? [];

    const title = isDay
        ? `${dayReport ? longDay(dayReport.sheet.day) : 'No counts yet'} · ${branch.name}`
        : `${monthReport ? longMonth(monthReport.month) : 'No counts yet'} · ${branch.name}`;

    const exportPdf = () => {
        const cell = (text: string, numeric = false) => `<td${numeric ? ' class="n"' : ''}>${escapeHtml(text)}</td>`;
        const body =
            `<p class="sub">${allRows.length} items · ${offRows.length} beyond ±${pct}% · ${flagged} flagged · variance value ${escapeHtml(peso(exposure))}</p>` +
            `<table><thead><tr><th>Item</th><th class="n">Begin</th><th class="n">In</th><th class="n">Ending</th><th class="n">Counted</th><th class="n">Expected</th><th class="n">Gap</th><th class="n">Value</th><th>Manager check</th></tr></thead><tbody>` +
            rows
                .map(
                    (row) =>
                        `<tr${row.mark === 'flag' ? ' style="background:#f6e3d6"' : row.off ? ' style="background:#fbf1e8"' : ''}>` +
                        cell(`${row.name} (${row.unit})`) +
                        cell(row.beginning === null ? '—' : trim(row.beginning), true) +
                        cell(row.received ? `+${trim(row.received)}` : '—', true) +
                        cell(row.ending === null ? '—' : trim(row.ending), true) +
                        cell(row.used === null ? '—' : trim(row.used), true) +
                        cell(row.expected === null ? '—' : trim(row.expected), true) +
                        cell(row.gap === null ? '—' : signed(row.gap), true) +
                        cell(gapValue(row), true) +
                        cell(row.mark === 'flag' ? `FLAGGED — ${row.note || 'no note'}` : row.mark === 'ok' ? 'Tallies' : '—') +
                        '</tr>',
                )
                .join('') +
            `</tbody></table><h3 style="margin:16px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Sales by item</h3><table><thead><tr><th>Product</th><th class="n">Qty</th><th class="n">Amount</th></tr></thead><tbody>` +
            sales.map((row) => `<tr>${cell(row.name)}${cell(String(row.qty), true)}${cell(peso(row.amount), true)}</tr>`).join('') +
            `</tbody></table><p style="margin-top:22px"><b>${escapeHtml(statusText)}</b>${
                isDay && sheet?.reviewed_by ? ` · ${escapeHtml(sheet.reviewed_by)} · ${escapeHtml(stamp(sheet.reviewed_at ?? null))}` : ''
            }</p><p class="muted">Signature ______________________________</p>`;

        printReport(isDay ? 'Daily stock count review' : 'Monthly stock count review', title, body, 'landscape');
    };

    const nav = (
        <>
            <NavHeading>Review</NavHeading>
            <div className="grid grid-cols-2 gap-1.5 px-3">
                {(['day', 'month'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => go({ view: option })}
                        className={cn(
                            'rounded-btn hover:border-accent min-h-9 cursor-pointer border px-1.5 py-2 text-[12.5px] font-semibold',
                            view === option ? 'border-accent-500 bg-accent-500 text-white' : 'border-white/18 bg-transparent text-neutral-100/76',
                        )}
                    >
                        {option === 'day' ? 'Daily' : 'Month'}
                    </button>
                ))}
            </div>
            <div className="px-3 pt-3.5 pb-1">
                <div className="mb-[5px] text-[10px] tracking-[.16em] uppercase opacity-60">{isDay ? 'Count date' : 'Month'}</div>
                <select
                    aria-label={isDay ? 'Count date' : 'Month'}
                    value={(isDay ? dayReport?.sheet.day : monthReport?.month) ?? ''}
                    onChange={(event) => go(isDay ? { day: event.target.value } : { month: event.target.value })}
                    className="focus:border-accent rounded-btn w-full cursor-pointer border border-white/18 bg-neutral-800 px-2 py-[7px] text-[13px] font-semibold text-neutral-100"
                >
                    {isDay
                        ? days.map((option) => (
                              <option key={option.day} value={option.day}>
                                  {longDay(option.day)}
                              </option>
                          ))
                        : months.map((option) => (
                              <option key={option} value={option}>
                                  {longMonth(option)}
                              </option>
                          ))}
                </select>
            </div>
            <button
                type="button"
                onClick={exportPdf}
                disabled={!allRows.length}
                className="rounded-btn mx-3 mt-3.5 min-h-10 cursor-pointer border border-white/14 bg-transparent px-2.5 py-[9px] text-[12.5px] font-semibold text-neutral-100/82 hover:bg-neutral-100/8 hover:text-neutral-100 disabled:opacity-40"
            >
                Export review as PDF
            </button>
            <Link href={route('count')} className="mx-3 mt-1.5 block px-0 py-2 text-[12.5px] text-neutral-100/62 hover:text-neutral-100">
                Go to today's count
            </Link>
        </>
    );

    return (
        <>
            <Head title="Stock report" />
            <StockShell
                appName="DMC Stock Report"
                kicker={isDay ? 'Daily count review' : 'Monthly stock report'}
                title={title}
                branch={branch}
                branches={branches}
                onBranch={(id) => router.get(route('report'), { branch: id, view })}
                nav={nav}
                headerEnd={
                    <>
                        {allRows.length > 0 && (
                            <div
                                className={cn(
                                    'flex flex-none items-center rounded-full px-[13px] py-1.5 text-[12.5px] font-semibold',
                                    signStatus === 'approved'
                                        ? 'bg-accent-2-200 text-accent-2-900'
                                        : signStatus === 'returned'
                                          ? 'bg-accent-200 text-accent-900'
                                          : 'text-text bg-neutral-200',
                                )}
                            >
                                {statusText}
                            </div>
                        )}
                        <input
                            className="input w-[200px] print:hidden"
                            placeholder="Search item or SKU"
                            aria-label="Search items"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </>
                }
                exitBody="You'll go back to the workspace picker. You stay signed in."
                toast={toast}
            >
                <div className="motion-safe:animate-tin">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
                        <Stat
                            label="Variance value"
                            value={peso(exposure)}
                            sub={`${offRows.length} of ${allRows.length} items beyond ±${pct}%`}
                            rule={offRows.length ? 'border-l-accent-500' : 'border-l-accent-2-500'}
                        />
                        <Stat label="Largest gap" value={worst?.name ?? '—'} sub={gapPhrase(worst)} small />
                        {isDay ? (
                            <Stat
                                label="Review"
                                value={`${checked} of ${allRows.length} checked`}
                                sub={flagged ? `${flagged} flagged for re-count` : 'none flagged'}
                                rule={flagged ? 'border-l-accent-500' : undefined}
                            />
                        ) : (
                            <Stat
                                label="Days approved"
                                value={`${monthReport?.sheets.filter((s) => s.status === 'approved').length ?? 0} of ${monthReport?.sheets.length ?? 0}`}
                                sub={`${monthReport?.sheets.reduce((sum, s) => sum + (s.received_items ?? 0), 0) ?? 0} items received`}
                            />
                        )}
                    </div>

                    {allRows.length === 0 ? (
                        <div className="bg-surface border-divider text-text/74 mt-4 rounded-md border p-[34px] text-center text-[13.5px]">
                            {isDay
                                ? `No count has been submitted at ${branch.name} yet.`
                                : `No counts were submitted at ${branch.name} in this month.`}
                        </div>
                    ) : (
                        <div className="mt-5 flex flex-col gap-[18px]">
                            <div className="bg-surface border-divider min-w-0 overflow-hidden rounded-md border">
                                <div className="border-divider flex flex-wrap items-baseline gap-x-3.5 gap-y-2.5 border-b px-[18px] pt-3.5 pb-3">
                                    <div className="text-[15px] font-semibold">Counted against sales</div>
                                    <div className="text-text/74 text-xs">
                                        {isDay
                                            ? `Counted by ${sheet?.by ?? '—'} · submitted ${stamp(sheet?.at ?? null)}${dayReport && dayReport.since !== dayReport.sheet.day ? ` · covers ${shortDay(dayReport.since)} – ${shortDay(dayReport.sheet.day)}` : ''}`
                                            : monthReport && monthReport.sheets.length
                                              ? `${monthReport.sheets.length} ${monthReport.sheets.length === 1 ? 'count' : 'counts'} · ${shortDay(monthReport.sheets[0].day)} – ${shortDay(monthReport.sheets[monthReport.sheets.length - 1].day)}`
                                              : ''}
                                    </div>
                                    <div className="ml-auto flex items-center gap-1.5 print:hidden">
                                        <button
                                            type="button"
                                            onClick={() => setOffOnly(!offOnly)}
                                            className={cn(
                                                'rounded-btn hover:border-accent cursor-pointer border px-2.5 py-[5px] text-[11.5px] font-semibold',
                                                offOnly ? 'border-accent-600 bg-accent-500 text-white' : 'border-divider text-text/74 bg-transparent',
                                            )}
                                        >
                                            {offOnly ? 'Showing gaps only' : `Off tolerance (${offRows.length})`}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSort(sort === 'gap' ? 'name' : 'gap')}
                                            className="border-divider text-text/74 rounded-btn hover:text-text cursor-pointer border bg-transparent px-2.5 py-[5px] text-[11.5px] font-semibold hover:bg-neutral-100"
                                        >
                                            {sort === 'gap' ? 'Sorted: worst gap' : 'Sorted: item name'}
                                        </button>
                                    </div>
                                </div>
                                <ReviewTable
                                    rows={rows}
                                    editable={isDay && dayEditable}
                                    monthly={!isDay}
                                    selected={selected}
                                    onSelect={setSelected}
                                    onChange={(row, changes) => act('patch', route('report.lines.update', row.line_id), changes)}
                                />
                                {rows.length === 0 && (
                                    <div className="text-text/74 p-[30px] text-center text-[13.5px]">
                                        {offOnly
                                            ? `Every counted item is within ±${pct}% of what sales predict.`
                                            : `No item matches “${query.trim()}”.`}
                                    </div>
                                )}
                                <div className="text-text/74 bg-neutral-100 px-4 py-[11px] text-xs leading-normal">
                                    {isDay
                                        ? 'Counted is beginning + in − ending. Expected is what the recipes of everything sold since the previous count would use. Items no recipe uses show a dash and are left out of the tolerance check.'
                                        : 'Beginning is the ending before the month’s first count. Expected covers every sale over the same days. Adjust endings and checks on the Daily view.'}
                                </div>
                            </div>

                            <div className="grid grid-cols-[repeat(auto-fit,minmax(330px,1fr))] gap-[18px]">
                                <SalesPanel
                                    sales={sales}
                                    sub={
                                        isDay && dayReport
                                            ? `${dayReport.since === dayReport.sheet.day ? longDay(dayReport.sheet.day) : `${shortDay(dayReport.since)} – ${shortDay(dayReport.sheet.day)}`} · from the POS`
                                            : `${monthReport ? longMonth(monthReport.month) : ''} · from the POS`
                                    }
                                />
                                <SignOff
                                    status={signStatus}
                                    by={isDay ? (sheet?.reviewed_by ?? null) : (monthReport?.review?.by ?? null)}
                                    role={isDay ? (sheet?.reviewed_role ?? null) : (monthReport?.review?.role ?? null)}
                                    at={isDay ? (sheet?.reviewed_at ?? null) : (monthReport?.review?.at ?? null)}
                                    canSign={canSign}
                                    isDay={isDay}
                                    onApprove={() =>
                                        isDay && sheet
                                            ? act('post', route('report.sheets.approve', sheet.id), {}, 'Day approved — endings posted as on hand')
                                            : monthReport &&
                                              act(
                                                  'put',
                                                  route('report.months.sign', [branch.id, monthReport.month]),
                                                  { status: 'approved' },
                                                  'Month approved',
                                              )
                                    }
                                    onReturn={() =>
                                        isDay && sheet
                                            ? act('post', route('report.sheets.return', sheet.id), {}, 'Returned for re-count')
                                            : monthReport &&
                                              act(
                                                  'put',
                                                  route('report.months.sign', [branch.id, monthReport.month]),
                                                  { status: 'returned' },
                                                  'Month returned for re-count',
                                              )
                                    }
                                    onReopen={() =>
                                        isDay && sheet
                                            ? act('post', route('report.sheets.reopen', sheet.id), {}, 'Review reopened')
                                            : monthReport &&
                                              act(
                                                  'put',
                                                  route('report.months.sign', [branch.id, monthReport.month]),
                                                  { status: null },
                                                  'Review reopened',
                                              )
                                    }
                                />
                            </div>

                            {!isDay && monthReport && (
                                <>
                                    <Movement report={monthReport} selected={selected ?? monthReport.rows[0]?.stock_item_id ?? null} />
                                    <MonthDays report={monthReport} onOpen={(day) => go({ view: 'day', day })} />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </StockShell>
        </>
    );
}

const gapValue = (row: ReviewRow) =>
    row.value === null || Math.round(row.value) === 0 ? '—' : `${row.value > 0 ? '−' : '+'}${peso(Math.abs(row.value))}`;

function Stat({ label, value, sub, rule, small = false }: { label: string; value: string; sub: string; rule?: string; small?: boolean }) {
    return (
        <div className={cn('bg-surface border-divider rounded-md border border-l-[3px] px-[18px] py-[15px]', rule ?? 'border-l-divider')}>
            <div className="text-text/74 text-[11px] tracking-[.07em] uppercase">{label}</div>
            <div className={cn('mt-1.5 truncate leading-[1.12] font-semibold', small ? 'text-[15px]' : 'text-[22px]')}>{value}</div>
            <div className="text-text/74 mt-1 text-xs">{sub}</div>
        </div>
    );
}

const COLUMNS = 'grid min-w-[700px] grid-cols-[minmax(104px,1.5fr)_52px_44px_68px_60px_64px_58px_68px_60px] gap-2';

function ReviewTable({
    rows,
    editable,
    monthly,
    selected,
    onSelect,
    onChange,
}: {
    rows: ReviewRow[];
    editable: boolean;
    monthly: boolean;
    selected: number | null;
    onSelect: (id: number) => void;
    onChange: (row: ReviewRow, changes: ReviewChanges) => void;
}) {
    const [endings, setEndings] = useState<Record<number, string>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});

    return (
        <div className="overflow-x-auto">
            <div
                className={cn(
                    COLUMNS,
                    'border-divider text-text/74 border-b bg-neutral-100 px-4 py-2.5 text-[10.5px] font-bold tracking-[.06em] uppercase',
                )}
            >
                <div>Item</div>
                <div className="text-right">Begin</div>
                <div className="text-right">In</div>
                <div className="text-right">Ending</div>
                <div className="text-right">Counted</div>
                <div className="text-right">Expected</div>
                <div className="text-right">Gap</div>
                <div className="text-right">Value</div>
                <div className="text-right">{monthly ? 'Days' : 'Check'}</div>
            </div>
            {rows.map((row) => {
                const edited = row.adjusted !== null && row.adjusted !== row.counted;
                const endingText = endings[row.line_id] ?? (row.ending === null ? '' : trim(row.ending));
                const saveEnding = () => {
                    const value = parseCount(endingText);

                    if (value === null && endingText !== '') {
                        return;
                    }

                    const adjusted = value === null || value === row.counted ? null : value;

                    if (adjusted !== row.adjusted) {
                        onChange(row, { adjusted });
                    }

                    setEndings((current) => {
                        const rest = { ...current };
                        delete rest[row.line_id];

                        return rest;
                    });
                };

                return (
                    <div
                        key={row.line_id}
                        className={cn(
                            'border-divider min-w-[700px] border-b',
                            row.mark === 'flag'
                                ? 'bg-accent-100'
                                : row.mark === 'ok'
                                  ? 'bg-accent-2-100'
                                  : row.off
                                    ? 'bg-accent-100/45'
                                    : 'bg-transparent',
                            monthly && selected === row.stock_item_id && 'outline-accent-400 outline outline-1 -outline-offset-1',
                        )}
                    >
                        <div
                            className={cn(COLUMNS, 'items-center px-4 py-2', monthly && 'cursor-pointer')}
                            onClick={monthly ? () => onSelect(row.stock_item_id) : undefined}
                        >
                            <div className="min-w-0">
                                <div className="truncate text-[13px]">{row.name}</div>
                                <div className="text-text/74 text-[10.5px]">
                                    {row.sku} · {row.unit}
                                    {monthly && row.days ? ` · ${row.days} ${row.days === 1 ? 'day' : 'days'}` : ''}
                                </div>
                            </div>
                            <div className="text-text/74 text-right text-[13px]">{row.beginning === null ? '—' : trim(row.beginning)}</div>
                            <div className={cn('text-right text-[13px]', row.received ? 'text-accent-2-800' : 'text-text/74')}>
                                {row.received ? `+${trim(row.received)}` : '—'}
                            </div>
                            <input
                                aria-label={`${row.name} ending`}
                                inputMode="decimal"
                                disabled={!editable}
                                title={edited ? `Counted ${row.counted === null ? '—' : trim(row.counted)}; corrected by the manager` : undefined}
                                value={endingText}
                                onChange={(event) =>
                                    setEndings((current) => ({ ...current, [row.line_id]: event.target.value.replace(/[^0-9.]/g, '') }))
                                }
                                onBlur={saveEnding}
                                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                                className={cn(
                                    'rounded-btn text-text focus:border-accent w-full border px-1.5 py-[5px] text-right text-[13px] font-semibold tabular-nums outline-none disabled:opacity-80',
                                    edited ? 'border-accent-400 bg-accent-100' : 'border-divider bg-bg',
                                )}
                            />
                            <div className="text-right text-[13px] font-semibold">{row.used === null ? '—' : trim(row.used)}</div>
                            <div className="text-text/74 text-right text-[13px]">{row.expected === null ? '—' : trim(row.expected)}</div>
                            <div className={cn('text-right text-[13px] font-semibold', row.off ? 'text-accent-800' : 'text-text/74')}>
                                {row.gap === null ? '—' : signed(row.gap)}
                            </div>
                            <div className={cn('text-right text-[12.5px]', row.off ? 'text-accent-800' : 'text-text/74')}>{gapValue(row)}</div>
                            {monthly ? (
                                <div className="text-text/74 text-right text-[12.5px]">{row.days ?? '—'}</div>
                            ) : (
                                <div className="flex justify-end gap-1">
                                    <CheckButton
                                        label={`${row.name} tallies`}
                                        symbol="✓"
                                        on={row.mark === 'ok'}
                                        tone="ok"
                                        disabled={!editable}
                                        onClick={() => onChange(row, { mark: row.mark === 'ok' ? null : 'ok' })}
                                    />
                                    <CheckButton
                                        label={`Flag ${row.name} for re-count`}
                                        symbol="⚑"
                                        on={row.mark === 'flag'}
                                        tone="flag"
                                        disabled={!editable}
                                        onClick={() => onChange(row, { mark: row.mark === 'flag' ? null : 'flag' })}
                                    />
                                </div>
                            )}
                        </div>
                        {!monthly && row.mark === 'flag' && (
                            <div className="px-4 pb-2.5">
                                <input
                                    aria-label={`Why ${row.name} is flagged`}
                                    disabled={!editable}
                                    maxLength={200}
                                    placeholder="Why is this flagged? (e.g. spillage, unrecorded staff drinks, delivery not keyed in)"
                                    value={notes[row.line_id] ?? row.note ?? ''}
                                    onChange={(event) => setNotes((current) => ({ ...current, [row.line_id]: event.target.value }))}
                                    onBlur={() => {
                                        const note = notes[row.line_id];

                                        if (note !== undefined && note !== (row.note ?? '')) {
                                            onChange(row, { note: note || null });
                                        }
                                    }}
                                    className="border-accent-300 rounded-btn bg-bg text-text focus:border-accent w-full border px-2 py-1.5 text-[12.5px] outline-none"
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function CheckButton({
    label,
    symbol,
    on,
    tone,
    disabled,
    onClick,
}: {
    label: string;
    symbol: string;
    on: boolean;
    tone: 'ok' | 'flag';
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            aria-pressed={on}
            title={tone === 'ok' ? 'Tallies' : 'Flag for re-count'}
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-btn size-[26px] cursor-pointer border p-0 text-[13px] leading-none font-semibold disabled:cursor-not-allowed',
                on
                    ? tone === 'ok'
                        ? 'border-accent-2-600 bg-accent-2-500 text-white'
                        : 'border-accent-600 bg-accent-500 text-white'
                    : cn(
                          'border-divider text-text/74 bg-transparent',
                          !disabled && (tone === 'ok' ? 'hover:border-accent-2-600' : 'hover:border-accent-600'),
                      ),
            )}
        >
            {symbol}
        </button>
    );
}

function SalesPanel({ sales, sub }: { sales: SalesRow[]; sub: string }) {
    const qty = sales.reduce((sum, row) => sum + row.qty, 0);
    const amount = sales.reduce((sum, row) => sum + row.amount, 0);

    return (
        <div className="bg-surface border-divider min-w-0 overflow-hidden rounded-md border">
            <div className="border-divider border-b px-[18px] pt-3.5 pb-3">
                <div className="text-[15px] font-semibold">Sales by item</div>
                <div className="text-text/74 mt-0.5 text-xs">{sub}</div>
            </div>
            <div className="border-divider text-text/74 grid grid-cols-[minmax(0,1fr)_46px_90px] gap-2 border-b bg-neutral-100 px-4 py-2.5 text-[10.5px] font-bold tracking-[.06em] uppercase">
                <div>Product</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Amount</div>
            </div>
            {sales.map((row) => (
                <div key={row.name} className="border-divider grid grid-cols-[minmax(0,1fr)_46px_90px] items-center gap-2 border-b px-4 py-2">
                    <div className="min-w-0">
                        <div className="truncate text-[13px]">{row.name}</div>
                        <div className="text-text/74 text-[10.5px]">{row.category ?? '—'}</div>
                    </div>
                    <div className="text-right text-[13px] font-semibold">{row.qty}</div>
                    <div className="text-text/74 text-right text-[13px]">{peso(row.amount)}</div>
                </div>
            ))}
            {sales.length === 0 ? (
                <div className="text-text/74 p-[26px] text-center text-[13px]">No sales recorded for this period.</div>
            ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_46px_90px] gap-2 bg-neutral-100 px-4 py-[11px] text-[12.5px] font-semibold">
                    <div>Total</div>
                    <div className="text-right">{qty}</div>
                    <div className="text-right">{peso(amount)}</div>
                </div>
            )}
        </div>
    );
}

interface SignOffProps {
    status: SheetStatus | null;
    by: string | null;
    role: string | null;
    at: string | null;
    canSign: boolean;
    isDay: boolean;
    onApprove: () => void;
    onReturn: () => void;
    onReopen: () => void;
}

function SignOff({ status, by, role, at, canSign, isDay, onApprove, onReturn, onReopen }: SignOffProps) {
    const closed = status === 'approved' || status === 'returned';

    return (
        <div className="bg-surface border-divider min-w-0 self-start rounded-md border p-[18px]">
            <div className="text-[15px] font-semibold">Manager sign-off</div>
            <div className="text-text/74 mt-1 text-[12.5px] leading-[1.45]">
                {closed
                    ? isDay
                        ? "This day is closed and its endings stand as the branch's on hand. Reopen it to change an ending figure or a flag."
                        : 'This month is closed. Reopen it to change its sign-off.'
                    : isDay
                      ? 'Work the gaps top down. Adjust an ending if the count was mis-keyed, flag what sales cannot explain, then approve. Approving posts these endings to the branch as on hand.'
                      : 'Check the month’s gaps, then approve it or return it for a re-count.'}
            </div>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={!canSign || closed}
                    onClick={onApprove}
                    className="border-accent-2-600 bg-accent-2-500 hover:bg-accent-2-600 rounded-btn min-h-10 cursor-pointer border px-2 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isDay ? 'Approve day' : 'Approve month'}
                </button>
                <button
                    type="button"
                    disabled={!canSign || closed}
                    onClick={onReturn}
                    className="border-divider text-text rounded-btn min-h-10 cursor-pointer border bg-transparent px-2 py-2.5 text-[13px] font-semibold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Return for re-count
                </button>
            </div>
            {closed && (
                <div className="border-divider mt-[13px] border-t pt-[13px] text-[12.5px] leading-normal">
                    <div className="font-semibold">{[by, role].filter(Boolean).join(' · ')}</div>
                    <div className="text-text/74">
                        {status === 'approved' ? 'Approved' : 'Returned for re-count'} · {stamp(at)}
                    </div>
                    {canSign && (
                        <button
                            type="button"
                            onClick={onReopen}
                            className="border-divider text-text/74 hover:text-text rounded-btn mt-[9px] cursor-pointer border bg-transparent px-2.5 py-1.5 text-xs hover:bg-neutral-100"
                        >
                            Reopen review
                        </button>
                    )}
                </div>
            )}
            {!canSign && <div className="text-accent-700 mt-3 text-[12.5px]">Sign-off is limited to the manager on duty (branch lead or owner).</div>}
        </div>
    );
}

function Movement({ report, selected }: { report: MonthReport; selected: number | null }) {
    const row = report.rows.find((candidate) => candidate.stock_item_id === selected);
    const series = selected === null ? [] : (report.series[selected] ?? []);
    const peak = Math.max(1, ...series.map((point) => point.ending));

    return (
        <div className="bg-surface border-divider rounded-md border px-[22px] pt-5 pb-[22px]">
            <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
                <div className="text-[15px] font-semibold">{row?.name ?? 'Movement'}</div>
                <div className="text-text/74 text-[12.5px]">
                    {row
                        ? `Ending counted on ${series.length} ${series.length === 1 ? 'day' : 'days'} · ${row.gap === null ? 'no sales comparison' : `${signed(row.gap)} ${row.unit} against sales this month`}`
                        : 'Select an item above'}
                </div>
            </div>
            <div className="mt-[18px] flex h-[150px] items-end gap-2 overflow-x-auto pb-0.5">
                {series.map((point) => (
                    <div key={point.day} className="flex h-full flex-[1_0_34px] flex-col items-center justify-end gap-1.5">
                        <div className="text-text/74 text-[11px] tabular-nums">{trim(point.ending)}</div>
                        <div
                            className="bg-accent-500 w-full rounded-t-[3px]"
                            style={{ height: `${Math.max(3, Math.round((point.ending / peak) * 100))}%` }}
                        />
                        <div className="text-text/74 text-[10.5px]">{shortDay(point.day).split(' ')[1]}</div>
                    </div>
                ))}
            </div>
            {row && row.received > 0 && (
                <div className="text-accent-2-800 mt-3 text-xs">
                    {trim(row.received)} {row.unit} received over these days.
                </div>
            )}
        </div>
    );
}

function MonthDays({ report, onOpen }: { report: MonthReport; onOpen: (day: string) => void }) {
    return (
        <div className="bg-surface border-divider overflow-x-auto rounded-md border">
            <div className="text-text/74 grid min-w-[470px] grid-cols-[minmax(80px,1fr)_minmax(92px,1.1fr)_60px_84px_minmax(88px,auto)] gap-2.5 bg-neutral-100 px-[18px] py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                <div>Date</div>
                <div>Submitted by</div>
                <div className="text-right">Items</div>
                <div className="text-right">Received</div>
                <div className="text-right">Review</div>
            </div>
            {[...report.sheets].reverse().map((sheet) => (
                <button
                    key={sheet.id}
                    type="button"
                    onClick={() => onOpen(sheet.day)}
                    className="border-divider grid w-full min-w-[470px] cursor-pointer grid-cols-[minmax(80px,1fr)_minmax(92px,1.1fr)_60px_84px_minmax(88px,auto)] items-center gap-2.5 border-t bg-transparent px-[18px] py-[13px] text-left hover:bg-neutral-100"
                >
                    <div className="text-[13.5px]">{shortDay(sheet.day)}</div>
                    <div className="text-text/74 text-[13px]">{sheet.by ?? '—'}</div>
                    <div className="text-right text-[13px]">{sheet.counted}</div>
                    <div className={cn('text-right text-[13px]', sheet.received_items ? 'text-accent-2-800' : 'text-text/74')}>
                        {sheet.received_items ? `${sheet.received_items} ${sheet.received_items === 1 ? 'item' : 'items'}` : '—'}
                    </div>
                    <div
                        className={cn(
                            'text-right text-[12.5px] font-semibold',
                            sheet.status === 'approved' ? 'text-accent-2-800' : sheet.status === 'returned' ? 'text-accent-800' : 'text-text/74',
                        )}
                    >
                        {sheet.status === 'approved' ? 'Approved' : sheet.status === 'returned' ? 'Re-count' : 'Pending'}
                    </div>
                </button>
            ))}
        </div>
    );
}
