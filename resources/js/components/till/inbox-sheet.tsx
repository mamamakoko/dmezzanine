import { type MarketingOrderView } from '@/lib/marketing';
import { pad2 } from '@/lib/till';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface InboxSheetProps {
    orders: MarketingOrderView[];
    processing: boolean;
    onAccept: (order: MarketingOrderView) => void;
    onDecline: (order: MarketingOrderView) => void;
    onClose: () => void;
}

/**
 * Orders marketing sent to this branch. Accepting puts one on the queue, unpaid, on the next free ticket;
 * declining tells the agent to call the branch. Answered orders stay listed for a few days.
 */
export function InboxSheet({ orders, processing, onAccept, onDecline, onClose }: InboxSheetProps) {
    const waiting = orders.filter((order) => order.status === 'sent').length;

    return (
        <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="bg-text/45 fixed inset-0 z-[86]" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="bg-bg font-body text-text motion-safe:animate-tin fixed top-[72px] right-[22px] z-[86] flex max-h-[calc(100vh-100px)] w-[calc(100%-32px)] max-w-[470px] flex-col rounded-md shadow-[var(--shadow-lg)]"
                >
                    <div className="border-divider border-b px-[22px] pt-5 pb-3.5">
                        <DialogPrimitive.Title className="m-0 mb-1 text-xl">Orders from marketing</DialogPrimitive.Title>
                        <p className="text-text/74 m-0 text-[12.5px]">
                            {waiting ? `${waiting} waiting for this branch to confirm` : 'Nothing waiting. Recent orders stay listed.'}
                        </p>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto overscroll-contain px-[22px] py-3.5">
                        {orders.length === 0 && (
                            <div className="text-text/74 px-1.5 py-[26px] text-center text-[13.5px]">Nothing from the marketing team yet.</div>
                        )}
                        {orders.map((order) => {
                            const pending = order.status === 'sent';

                            return (
                                <div
                                    key={order.id}
                                    className={cn(
                                        'rounded-md border bg-neutral-100 px-[17px] py-4',
                                        pending ? 'border-accent-300' : order.status === 'declined' ? 'border-accent-2-400' : 'border-divider',
                                    )}
                                >
                                    <div className="mb-2 flex items-center justify-between gap-2.5">
                                        <div className="text-base font-semibold">
                                            {order.no} · {order.customer}
                                        </div>
                                        <span
                                            className={cn(
                                                'rounded-btn px-[11px] py-[5px] text-[11.5px] font-semibold tracking-[.06em] whitespace-nowrap uppercase',
                                                pending
                                                    ? 'bg-accent text-bg'
                                                    : order.status === 'declined'
                                                      ? 'bg-accent-2-800 text-neutral-100'
                                                      : 'bg-neutral-800 text-neutral-100',
                                            )}
                                        >
                                            {pending ? 'New' : order.progress}
                                        </span>
                                    </div>
                                    <div className="text-text/74 mb-2.5 text-[12.5px]">
                                        {[order.service_label, order.phone, order.address].filter(Boolean).join(' · ')}
                                    </div>
                                    <div className="flex max-h-[132px] flex-col gap-[3px] overflow-auto overscroll-contain text-[13.5px]">
                                        {order.lines.map((line, index) => (
                                            <div key={index}>
                                                {line.qty}× {line.name}
                                                {line.addons.length > 0 && (
                                                    <span className="text-text/74"> · {line.addons.map((addon) => addon.name).join(' · ')}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="bg-accent-100 mt-2.5 rounded-[8px] px-[11px] py-2 text-[12.5px]">
                                        Needed {order.wanted || 'as soon as possible'}
                                    </div>
                                    {order.note && <div className="bg-surface mt-2 rounded-[8px] px-[11px] py-2 text-[12.5px]">{order.note}</div>}
                                    <div className="border-divider mt-3.5 flex items-center gap-2.5 border-t pt-3">
                                        <span className="text-text/74 flex-1 text-xs">Sent by {order.agent?.split(' ')[0] ?? 'marketing'}</span>
                                        {pending ? (
                                            <>
                                                <button
                                                    type="button"
                                                    disabled={processing}
                                                    onClick={() => onDecline(order)}
                                                    className="border-divider bg-bg rounded-btn min-h-11 cursor-pointer border px-4 text-[13.5px] font-semibold disabled:opacity-60"
                                                >
                                                    Decline
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={processing}
                                                    onClick={() => onAccept(order)}
                                                    className="border-accent bg-accent text-bg rounded-btn min-h-11 cursor-pointer border px-[18px] text-[13.5px] font-semibold disabled:opacity-60"
                                                >
                                                    Accept
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-text/74 text-[12.5px]">
                                                {order.status === 'declined'
                                                    ? 'Declined'
                                                    : `On the board${order.ticket ? ` · ticket ${pad2(order.ticket)}` : ''}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="border-divider flex justify-end border-t px-[22px] pt-3.5 pb-[18px]">
                        <button type="button" onClick={onClose} className="btn btn-secondary px-[22px] py-[11px] text-[13.5px] font-semibold">
                            Close
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
