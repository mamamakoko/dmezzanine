import { Sheet } from '@/components/till/sheet';
import { isoDate, openScreen, stamp, type LogEntry, type LogKind, type OwnerProps } from '@/lib/owner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const ICONS: Record<LogKind, { icon: string; tone: string }> = {
    stock: { icon: '▧', tone: 'bg-neutral-200 text-neutral-800' },
    req: { icon: '⇅', tone: 'bg-accent-2-200 text-accent-2-900' },
    user: { icon: '⚷', tone: 'bg-neutral-200 text-neutral-800' },
    count: { icon: '▤', tone: 'bg-neutral-200 text-neutral-800' },
};

const KIND_CHIPS: [string, LogKind | 'all'][] = [
    ['All', 'all'],
    ['Stock', 'stock'],
    ['Requests', 'req'],
    ['Users', 'user'],
    ['Counts', 'count'],
];

/**
 * The activity log: sign-ins and Owner console changes, count sheets, transfers and deliveries, newest
 * first. Dates are filtered on the server; the category on screen.
 */
export function ActivityLog({ log }: { log: NonNullable<OwnerProps['log']> }) {
    const [kind, setKind] = useState<LogKind | 'all'>('all');
    const [open, setOpen] = useState<LogEntry | null>(null);

    const today = isoDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = isoDate(yesterdayDate);

    const dateChip =
        log.from === null && log.to === null
            ? 'all'
            : log.from === log.to && log.from === today
              ? 'today'
              : log.from === log.to && log.from === yesterday
                ? 'yesterday'
                : null;
    const shown = log.entries.filter((entry) => kind === 'all' || entry.kind === kind);

    const setDates = (from: string | null, to: string | null) =>
        openScreen('log', Object.fromEntries(Object.entries({ from, to }).filter((entry): entry is [string, string] => Boolean(entry[1]))));

    const chip = (on: boolean) =>
        cn(
            'rounded-btn min-h-8 cursor-pointer border px-[11px] py-1.5 text-[12.5px] whitespace-nowrap',
            on ? 'border-neutral-900 bg-neutral-900 text-neutral-100' : 'border-divider bg-surface text-text',
        );

    return (
        <div className="motion-safe:animate-tin">
            <div className="mb-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-text/74 mr-0.5 text-[11.5px] tracking-[.06em] uppercase">Date</span>
                    <button type="button" className={chip(dateChip === 'all')} onClick={() => setDates(null, null)}>
                        All dates
                    </button>
                    <button type="button" className={chip(dateChip === 'today')} onClick={() => setDates(today, today)}>
                        Today
                    </button>
                    <button type="button" className={chip(dateChip === 'yesterday')} onClick={() => setDates(yesterday, yesterday)}>
                        Yesterday
                    </button>
                    <div className="flex items-center gap-[5px]">
                        <input
                            type="date"
                            aria-label="From"
                            value={log.from ?? ''}
                            onChange={(event) => setDates(event.target.value || null, log.to)}
                            className="rounded-btn border-divider bg-surface text-text min-h-8 border px-[7px] py-[5px] text-xs"
                        />
                        <span className="text-text/74 text-xs">to</span>
                        <input
                            type="date"
                            aria-label="To"
                            value={log.to ?? ''}
                            onChange={(event) => setDates(log.from, event.target.value || null)}
                            className="rounded-btn border-divider bg-surface text-text min-h-8 border px-[7px] py-[5px] text-xs"
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-text/74 mr-0.5 text-[11.5px] tracking-[.06em] uppercase">Category</span>
                    {KIND_CHIPS.map(([label, value]) => (
                        <button key={value} type="button" className={chip(kind === value)} onClick={() => setKind(value)}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="text-text/74 ml-auto text-xs tabular-nums">
                    {shown.length} {shown.length === 1 ? 'entry' : 'entries'}
                    {log.entries.length >= log.limit && ` · newest ${log.limit}`}
                </div>
            </div>

            <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                {shown.map((entry) => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setOpen(entry)}
                        className="border-divider hover:bg-bg grid w-full min-w-[620px] cursor-pointer grid-cols-[126px_26px_1fr_150px] items-center gap-3.5 border-b px-[18px] py-3 text-left"
                    >
                        <div className="text-text/74 text-xs tabular-nums">{stamp(entry.at)}</div>
                        <KindDot kind={entry.kind} />
                        <div className="min-w-0">
                            <div className="text-[13.5px]">{entry.what}</div>
                            {entry.detail && <div className="text-text/74 text-[11.5px]">{entry.detail}</div>}
                        </div>
                        <div className="justify-self-end text-[12.5px]">{entry.who}</div>
                    </button>
                ))}
                {shown.length === 0 && (
                    <div className="text-text/74 px-[18px] py-[38px] text-center text-[13px]">No activity matches these filters.</div>
                )}
            </div>

            <Sheet
                open={open !== null}
                onClose={() => setOpen(null)}
                title={
                    <span className="flex items-start gap-[13px]">
                        {open && <KindDot kind={open.kind} size="size-[34px] text-[15px]" />}
                        <span className="min-w-0">
                            <span className="block text-[17px] leading-[1.25]">{open?.what}</span>
                            <span className="text-text/74 block text-[12.5px] font-normal">
                                {open?.kind_label} · {open?.id}
                            </span>
                        </span>
                    </span>
                }
                width="max-w-[480px]"
            >
                {open && (
                    <div className="mt-4">
                        {[
                            ['Timestamp', `${stamp(open.at)} · ${new Date(open.at).getFullYear()}`],
                            ['Event type', open.kind_label],
                            ['Details', open.detail ?? '—'],
                            ['Performed by', open.who],
                            ['Reference', open.id],
                            ['Source', open.source],
                        ].map(([label, value]) => (
                            <div key={label} className="border-divider grid grid-cols-[112px_1fr] gap-3.5 border-b py-[11px]">
                                <div className="text-text/74 pt-0.5 text-[11.5px] tracking-[.06em] uppercase">{label}</div>
                                <div className="text-[13.5px] text-pretty tabular-nums">{value}</div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-[18px] flex justify-end">
                    <button type="button" onClick={() => setOpen(null)} className="btn btn-secondary px-5 py-2.5 text-[13.5px]">
                        Close
                    </button>
                </div>
            </Sheet>
        </div>
    );
}

function KindDot({ kind, size = 'size-[26px] text-xs' }: { kind: LogKind; size?: string }) {
    return <div className={cn('flex flex-none items-center justify-center rounded-full', size, ICONS[kind].tone)}>{ICONS[kind].icon}</div>;
}
