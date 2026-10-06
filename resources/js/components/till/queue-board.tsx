import { minutesSince, NEXT_STATUS, pad2, peso, STATUS_LABELS, type TillOrder } from '@/lib/till';
import { cn } from '@/lib/utils';
import { type CSSProperties } from 'react';

interface QueueBoardProps {
    orders: TillOrder[];
    now: Date;
    onAdvance: (order: TillOrder) => void;
    onSettle: (order: TillOrder) => void;
    onPrintTicket: (order: TillOrder) => void;
}

/**
 * The orders the kitchen is working on: Preparing → Ready → Served. A card heats from white to red the
 * longer it sits in Preparing. Unpaid orders (Branch Menu orders and tabs) stay until they are settled.
 */
export function QueueBoard({ orders, now, onAdvance, onSettle, onPrintTicket }: QueueBoardProps) {
    if (orders.length === 0) {
        return (
            <div className="text-text/74 flex flex-1 flex-col items-center justify-center gap-1 p-10 text-center">
                <div className="text-text text-lg font-semibold">The queue is clear</div>
                <div className="text-sm">New orders appear here as soon as they are charged or sent.</div>
            </div>
        );
    }

    return (
        <div className="min-h-0 flex-1 overflow-auto px-5 py-[18px]">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
                {orders.map((order) => {
                    const minutes = minutesSince(order.created_at, now);
                    const next = NEXT_STATUS[order.status];

                    return (
                        <div key={order.id} className="flex flex-col rounded-md border p-4" style={cardStyle(order, minutes)}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[17px] font-semibold">
                                        #{order.no} · Ticket {pad2(order.ticket)}
                                    </div>
                                    <div className="text-text/74 text-[12.5px]">
                                        {order.service} · {minutes === 0 ? 'just now' : `${minutes} min ago`}
                                        {order.source === 'branch_menu' && ' · from Branch Menu'}
                                    </div>
                                </div>
                                <span
                                    className={cn(
                                        'rounded-btn px-2 py-1 text-[11.5px] font-semibold text-neutral-100',
                                        order.status === 'ready' ? 'bg-accent' : order.status === 'served' ? 'bg-neutral-800' : 'bg-accent-2-800',
                                    )}
                                >
                                    {STATUS_LABELS[order.status]}
                                </span>
                            </div>

                            <div className="my-3 flex flex-col gap-1">
                                {order.lines.map((line, index) => (
                                    <div key={index} className="text-[13.5px]">
                                        <span className="font-semibold tabular-nums">{line.qty}×</span> {line.name}
                                        {line.mods !== 'No changes' && <span className="text-text/74"> · {line.mods}</span>}
                                    </div>
                                ))}
                            </div>

                            {order.note && <div className="bg-accent-2-100 mb-3 rounded-[8px] px-3 py-2 text-[12.5px]">{order.note}</div>}

                            <div className="mt-auto flex items-center justify-between gap-2 text-[13px]">
                                <span className={order.unpaid ? 'text-accent-700 font-semibold' : 'text-text/74'}>
                                    {order.unpaid
                                        ? order.tab_name
                                            ? `Unpaid · tab for ${order.tab_name}`
                                            : 'Unpaid'
                                        : (order.payments ?? []).map((p) => p.method).join(' + ')}
                                </span>
                                <span className="font-semibold tabular-nums">{peso(order.total ?? 0)}</span>
                            </div>

                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onPrintTicket(order)}
                                    className="btn btn-secondary min-h-11 px-3 text-[13px] font-semibold"
                                    title="Print the kitchen ticket"
                                >
                                    Ticket
                                </button>
                                {order.unpaid && (
                                    <button
                                        type="button"
                                        onClick={() => onSettle(order)}
                                        className="btn btn-primary min-h-11 flex-1 px-3 text-[13.5px] font-semibold"
                                    >
                                        Take payment
                                    </button>
                                )}
                                {next && (
                                    <button
                                        type="button"
                                        onClick={() => onAdvance(order)}
                                        className={cn(
                                            'btn min-h-11 flex-1 px-3 text-[13.5px] font-semibold',
                                            order.unpaid ? 'btn-secondary' : 'btn-primary',
                                        )}
                                    >
                                        Mark {STATUS_LABELS[next].toLowerCase()}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Green when served, otherwise white heating towards red after 5 minutes in Preparing. */
function cardStyle(order: TillOrder, minutes: number): CSSProperties {
    if (order.status === 'served') {
        return { background: 'var(--color-accent-2-200)', borderColor: 'var(--color-accent-2-500)', boxShadow: 'var(--shadow-sm)' };
    }

    if (order.status !== 'preparing') {
        return { background: 'var(--color-neutral-100)', borderColor: 'var(--color-divider)', boxShadow: 'var(--shadow-sm)' };
    }

    const heat = Math.max(0, Math.min(1, (minutes - 5) / 7));

    return {
        background: `color-mix(in oklch, #d94f2b ${Math.round(heat * 62)}%, var(--color-neutral-100))`,
        borderColor: heat > 0.05 ? `color-mix(in oklch, #b8371a ${Math.round(25 + heat * 75)}%, var(--color-divider))` : 'var(--color-divider)',
        boxShadow: heat > 0.6 ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    };
}
