import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog } from '@/components/till/sheet';
import { IssueSheet } from '@/components/transfers/issue-sheet';
import { DateFilter, TransferCard } from '@/components/transfers/transfer-card';
import { type Location, type ScreenData } from '@/lib/inventory';
import { inRange, isCancellable, matchesSearch, qty, type TransferLineRow, type TransferRow } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Ask = { mode: 'approve' | 'reject' | 'cancel'; transfer: TransferRow };

const ASK_COPY: Record<Ask['mode'], { title: string; confirm: string; tail: string }> = {
    approve: { title: 'Approve this request?', confirm: 'Approve request', tail: 'stock moves when issued' },
    reject: { title: 'Reject this request?', confirm: 'Reject request', tail: 'no stock will move' },
    cancel: { title: 'Cancel this transfer?', confirm: 'Cancel transfer', tail: 'no stock will move' },
};

/**
 * A warehouse or commissary's transfers, inbound and outbound. The source approves, rejects and issues; the
 * destination receives (line by line or in full) and can cancel its own request until it is sent.
 */
export function LocationTransfers({
    data,
    location,
    today,
    query,
    toast,
}: {
    data: ScreenData<'wh'>;
    location: Location;
    today: string;
    query: string;
    toast: (message: string) => void;
}) {
    const transfers = data.transfers ?? [];
    const [direction, setDirection] = useState<'in' | 'out'>('in');
    const [range, setRange] = useState({ from: today, to: today });
    const [openId, setOpenId] = useState<number | null>(null);
    const [ask, setAsk] = useState<Ask | null>(null);
    const [flagging, setFlagging] = useState<{ transfer: TransferRow; line: TransferLineRow } | null>(null);
    const { send, processing } = useBackOfficeAction(toast);

    const mine = (transfer: TransferRow, dir: 'in' | 'out') => (dir === 'in' ? transfer.to.id : transfer.from.id) === location.id;
    const dated = (dir: 'in' | 'out') => transfers.filter((transfer) => mine(transfer, dir) && inRange(transfer, range.from, range.to));
    const shown = dated(direction).filter((transfer) => matchesSearch(transfer, query));

    const act = (name: 'approve' | 'reject' | 'issue' | 'cancel' | 'receive', transfer: TransferRow, success: string) =>
        send('post', route(`inventory.transfers.${name}`, transfer.id), {}, { success, onSuccess: () => setAsk(null) });

    const actionsFor = (transfer: TransferRow) => {
        if (!location.can) {
            return {};
        }

        const flag = (line: TransferLineRow) => setFlagging({ transfer, line });

        if (direction === 'out') {
            return {
                approve: transfer.status === 'requested' ? () => setAsk({ mode: 'approve', transfer }) : undefined,
                reject: transfer.status === 'requested' ? () => setAsk({ mode: 'reject', transfer }) : undefined,
                issue:
                    transfer.status === 'approved'
                        ? () => act('issue', transfer, `${transfer.no} issued · stock deducted from ${location.name}`)
                        : undefined,
                flag,
            };
        }

        return {
            cancel: isCancellable(transfer) ? () => setAsk({ mode: 'cancel', transfer }) : undefined,
            receiveAll: () => act('receive', transfer, `${transfer.no} received in full`),
            receiveLine: (line: TransferLineRow) =>
                send(
                    'post',
                    route('inventory.transfers.lines.receive', [transfer.id, line.id]),
                    {},
                    { success: `Received ${qty(line.qty, line.unit)} · ${line.name}` },
                ),
            flag,
        };
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <div className="border-divider bg-surface rounded-btn flex gap-1 border p-1">
                    {(['in', 'out'] as const).map((dir) => (
                        <button
                            key={dir}
                            type="button"
                            onClick={() => {
                                setDirection(dir);
                                setOpenId(null);
                            }}
                            className={cn(
                                'rounded-btn flex min-h-9 cursor-pointer items-center gap-[7px] px-[15px] py-[7px] text-[13px] font-semibold whitespace-nowrap transition-colors',
                                direction === dir ? 'bg-accent text-neutral-100' : 'text-text bg-transparent',
                            )}
                        >
                            {dir === 'in' ? 'Inbound' : 'Outbound'} <span className="text-[11px] opacity-65">{dated(dir).length}</span>
                        </button>
                    ))}
                </div>
                <div className="text-text/74 text-[12.5px]">
                    {direction === 'in' ? 'Stock arriving into ' : 'Stock leaving '}
                    {location.name}
                </div>
                <div className="min-w-3 flex-1" />
                <DateFilter from={range.from} to={range.to} today={today} onChange={(from, to) => setRange({ from, to })} />
            </div>

            {shown.map((transfer) => (
                <TransferCard
                    key={transfer.id}
                    transfer={transfer}
                    direction={direction}
                    open={openId === transfer.id}
                    onToggle={() => setOpenId(openId === transfer.id ? null : transfer.id)}
                    actions={actionsFor(transfer)}
                    busy={processing}
                />
            ))}
            {shown.length === 0 && (
                <div className="border-divider bg-surface text-text/74 rounded-md border p-[34px] text-center text-[13.5px]">
                    No transfers in this direction for the selected dates.
                </div>
            )}

            <ConfirmDialog
                open={ask !== null}
                title={ask ? ASK_COPY[ask.mode].title : ''}
                body={
                    ask
                        ? `${ask.transfer.no} · ${ask.transfer.kind} · ${ask.transfer.from.name} → ${ask.transfer.to.name} · ${ask.transfer.lines.length} lines · ${ASK_COPY[ask.mode].tail}`
                        : ''
                }
                cancelLabel="Go back"
                confirmLabel={ask ? ASK_COPY[ask.mode].confirm : ''}
                onCancel={() => setAsk(null)}
                onConfirm={() =>
                    ask &&
                    act(ask.mode, ask.transfer, `${ask.transfer.no} ${{ approve: 'approved', reject: 'rejected', cancel: 'cancelled' }[ask.mode]}`)
                }
            />
            <IssueSheet
                target={flagging}
                busy={processing}
                onClose={() => setFlagging(null)}
                onSave={(reason, note) =>
                    flagging &&
                    send(
                        'put',
                        route('inventory.transfers.lines.flag', [flagging.transfer.id, flagging.line.id]),
                        { reason, note },
                        {
                            success: `Issue flagged on ${flagging.transfer.no}`,
                            onSuccess: () => setFlagging(null),
                        },
                    )
                }
            />
        </div>
    );
}
