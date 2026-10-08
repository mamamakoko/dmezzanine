import {
    isClosed,
    isReceivable,
    lineState,
    progressLabel,
    qty,
    raisedLabel,
    STATUS_TONE,
    type TransferLineRow,
    type TransferRow,
} from '@/lib/transfers';
import { cn } from '@/lib/utils';

export interface TransferActions {
    /** The source approves or rejects a new request. */
    approve?: () => void;
    reject?: () => void;
    /** The source sends an approved transfer. */
    issue?: () => void;
    /** The requester withdraws its request. */
    cancel?: () => void;
    receiveAll?: () => void;
    receiveLine?: (line: TransferLineRow) => void;
    flag?: (line: TransferLineRow) => void;
}

interface TransferCardProps {
    transfer: TransferRow;
    /** Inbound shows where it comes from; outbound where it goes. */
    direction: 'in' | 'out';
    open: boolean;
    onToggle: () => void;
    actions: TransferActions;
    /** The till's cards sit on the cream page; Inventory's on the surface colour. */
    tone?: 'till' | 'inventory';
    busy?: boolean;
}

const actionButton = 'rounded-btn min-h-10 cursor-pointer px-4 py-[9px] text-[13px] whitespace-nowrap disabled:opacity-50';

/**
 * A transfer with its lines folded away: number, kind, route, status and progress, then each line's state
 * and the actions the viewer may take.
 */
export function TransferCard({ transfer, direction, open, onToggle, actions, tone = 'inventory', busy }: TransferCardProps) {
    const closed = isClosed(transfer);
    const receivable = isReceivable(transfer);
    const footer = [actions.approve, actions.reject, actions.issue, actions.cancel, receivable ? actions.receiveAll : undefined].some(Boolean);

    return (
        <div className={cn('border-divider overflow-hidden rounded-md border', tone === 'till' ? 'bg-neutral-100' : 'bg-surface')}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3.5 px-[18px] py-4">
                <div className="min-w-0 flex-[1_1_220px]">
                    <div className="flex flex-wrap items-baseline gap-[9px]">
                        <span className="text-[15px] font-semibold">{transfer.no}</span>
                        <span
                            className={cn('rounded-btn text-text/74 px-[9px] py-[3px] text-[11.5px]', tone === 'till' ? 'bg-bg' : 'bg-neutral-100')}
                        >
                            {transfer.kind}
                        </span>
                        <span className="text-sm">{direction === 'in' ? `From ${transfer.from.name}` : `To ${transfer.to.name}`}</span>
                    </div>
                    <div className="text-text/74 mt-[3px] text-[11.5px]">
                        {raisedLabel(transfer.raised_at)}
                        {transfer.by ? ` · ${transfer.by}` : ''}
                        {transfer.status === 'requested' && direction === 'in' ? ' · awaiting approval' : ''}
                    </div>
                </div>
                <div className="flex-none">
                    <span className={cn('rounded-btn inline-block px-2.5 py-1 text-[11.5px] whitespace-nowrap', STATUS_TONE[transfer.status])}>
                        {transfer.status_label}
                    </span>
                    <div className="text-text/74 mt-1 text-[11.5px] whitespace-nowrap">{progressLabel(transfer)}</div>
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-expanded={open}
                    className="border-divider bg-bg rounded-btn hover:border-accent min-h-10 flex-none cursor-pointer border px-3 py-1.5 text-[12.5px] whitespace-nowrap"
                >
                    {open ? 'Hide lines' : 'View lines'}
                </button>
            </div>

            {open && (
                <div className={cn('border-divider motion-safe:animate-tin border-t', tone === 'till' ? 'bg-bg' : 'bg-neutral-100')}>
                    {transfer.lines.map((line) => (
                        <div key={line.id} className="border-divider flex flex-wrap items-center gap-x-[18px] gap-y-2.5 border-b px-[18px] py-[11px]">
                            <div className="min-w-0 flex-[1_1_160px] text-[13.5px]">{line.name}</div>
                            <div className="flex-none text-[13px] font-semibold whitespace-nowrap tabular-nums">{qty(line.qty, line.unit)}</div>
                            <div className="ml-auto flex flex-none flex-wrap items-center gap-2">
                                <span className={cn('text-xs whitespace-nowrap', line.received ? 'text-accent-2-800' : 'text-text/74')}>
                                    {lineState(transfer, line)}
                                </span>
                                {line.issue && (
                                    <span className="rounded-btn bg-accent-200 text-accent-900 px-2 py-[3px] text-[11.5px] whitespace-nowrap">
                                        {line.issue.label}
                                    </span>
                                )}
                                {actions.receiveLine && receivable && !line.received && (
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => actions.receiveLine?.(line)}
                                        className="border-divider bg-surface rounded-btn min-h-9 cursor-pointer border px-[9px] py-1 text-[11.5px] disabled:opacity-50"
                                    >
                                        Receive
                                    </button>
                                )}
                                {actions.flag && !closed && (
                                    <button
                                        type="button"
                                        onClick={() => actions.flag?.(line)}
                                        className="border-divider rounded-btn text-text/74 hover:border-accent hover:text-accent-800 min-h-9 cursor-pointer border bg-transparent px-[9px] py-1 text-[11.5px]"
                                    >
                                        {line.issue ? 'Edit issue' : 'Report issue'}
                                    </button>
                                )}
                            </div>
                            {line.issue?.note && <div className="text-text/74 basis-full text-[11.5px]">{line.issue.note}</div>}
                        </div>
                    ))}

                    {footer && !closed && (
                        <div className="flex flex-wrap gap-2.5 px-[18px] py-3.5">
                            {actions.approve && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={actions.approve}
                                    className={cn(actionButton, 'bg-accent font-semibold text-neutral-100')}
                                >
                                    Approve request
                                </button>
                            )}
                            {actions.reject && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={actions.reject}
                                    className={cn(actionButton, 'border-divider border bg-transparent')}
                                >
                                    Reject
                                </button>
                            )}
                            {actions.issue && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={actions.issue}
                                    className={cn(actionButton, 'bg-accent font-semibold text-neutral-100')}
                                >
                                    Issue &amp; send
                                </button>
                            )}
                            {actions.cancel && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={actions.cancel}
                                    className={cn(actionButton, 'border-divider hover:border-accent hover:text-accent-800 border bg-transparent')}
                                >
                                    Cancel request
                                </button>
                            )}
                            {actions.receiveAll && receivable && transfer.lines.some((line) => !line.received) && (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={actions.receiveAll}
                                    className={cn(actionButton, 'bg-accent font-semibold text-neutral-100')}
                                >
                                    Receive all lines
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

interface DateFilterProps {
    from: string;
    to: string;
    today: string;
    onChange: (from: string, to: string) => void;
    /** Shows the Today shortcut. */
    withToday?: boolean;
}

/**
 * Date · Today · from–to · All dates, as the transfer lists filter.
 */
export function DateFilter({ from, to, today, onChange, withToday = true }: DateFilterProps) {
    const isToday = from === today && to === today;
    const isAll = !from && !to;
    const chip = (on: boolean) =>
        cn(
            'rounded-btn min-h-9 cursor-pointer border px-[11px] py-1.5 text-[12.5px] whitespace-nowrap',
            on ? 'border-accent bg-accent text-neutral-100' : 'border-divider text-text/74 bg-transparent',
        );

    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-text/74 text-[11.5px] tracking-[.06em] uppercase">Date</span>
            {withToday && (
                <button type="button" onClick={() => onChange(today, today)} className={chip(isToday)}>
                    Today
                </button>
            )}
            <div className="flex items-center gap-[5px]">
                <input
                    type="date"
                    aria-label="From date"
                    value={from}
                    onChange={(event) => onChange(event.target.value, to)}
                    className="border-divider bg-bg text-text rounded-btn border px-[7px] py-[5px] text-xs"
                />
                <span className="text-text/74 text-xs">to</span>
                <input
                    type="date"
                    aria-label="To date"
                    value={to}
                    onChange={(event) => onChange(from, event.target.value)}
                    className="border-divider bg-bg text-text rounded-btn border px-[7px] py-[5px] text-xs"
                />
            </div>
            <button type="button" onClick={() => onChange('', '')} className={chip(isAll)}>
                All dates
            </button>
        </div>
    );
}
