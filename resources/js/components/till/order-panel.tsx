import { pad2, peso, peso2, type CartLine, type Totals } from '@/lib/till';
import { cn } from '@/lib/utils';

export type Service = 'dine_in' | 'takeout';

export const SERVICES: { value: Service; label: string }[] = [
    { value: 'dine_in', label: 'Dine-in' },
    { value: 'takeout', label: 'Takeout' },
];

interface OrderPanelProps {
    orderOnly: boolean;
    service: Service;
    onService: (service: Service) => void;
    tickets: number;
    ticket: number;
    onTicket: (ticket: number) => void;
    openTickets: number[];
    cart: CartLine[];
    onQty: (key: string, delta: number) => void;
    nextOrderNo: number;
    senior: boolean;
    onSenior: (senior: boolean) => void;
    totals: Totals;
    onVoid: () => void;
    onCharge: () => void;
}

/**
 * The pending order on the right of the till: service, ticket number, lines and totals.
 */
export function OrderPanel(props: OrderPanelProps) {
    const { orderOnly, cart, totals } = props;
    const itemCount = cart.reduce((count, line) => count + line.qty, 0);

    return (
        <div className="border-divider flex w-full flex-none flex-col border-t bg-neutral-100 lg:w-[404px] lg:border-t-0 lg:border-l">
            <div className="border-divider border-b px-5 pt-[18px] pb-3.5">
                <div className="bg-surface rounded-btn mb-3 flex gap-1 p-1">
                    {SERVICES.map((service) => (
                        <button
                            key={service.value}
                            type="button"
                            onClick={() => props.onService(service.value)}
                            className={cn(
                                'rounded-btn text-text min-h-11 flex-1 cursor-pointer text-sm font-semibold',
                                props.service === service.value ? 'bg-neutral-100' : 'bg-transparent',
                            )}
                        >
                            {service.label}
                        </button>
                    ))}
                </div>

                <div className="mb-2 flex items-baseline justify-between">
                    <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Pending ticket</div>
                    <div className="text-accent-700 text-sm font-semibold">No. {pad2(props.ticket)}</div>
                </div>
                <div className="flex flex-wrap gap-[7px]">
                    {Array.from({ length: props.tickets }, (_, index) => index + 1).map((ticket) => {
                        const open = props.openTickets.includes(ticket);
                        const selected = props.ticket === ticket;

                        return (
                            <button
                                key={ticket}
                                type="button"
                                disabled={open}
                                aria-pressed={selected}
                                title={open ? `Ticket ${pad2(ticket)} is still open` : undefined}
                                onClick={() => props.onTicket(ticket)}
                                className={cn(
                                    'h-11 w-12 cursor-pointer rounded-[8px] border text-[13.5px] font-semibold tabular-nums disabled:cursor-not-allowed',
                                    selected
                                        ? 'border-accent bg-accent text-bg'
                                        : open
                                          ? 'border-divider bg-surface text-text/74'
                                          : 'border-divider text-text hover:border-accent-400 bg-transparent',
                                )}
                            >
                                {pad2(ticket)}
                            </button>
                        );
                    })}
                </div>
                <div className="text-text/74 mt-2 text-[11.5px]">Tickets run 1–{props.tickets}, then recycle. Faded numbers are still open.</div>
            </div>

            <div className="min-h-[180px] flex-[3_1_0] overflow-auto overscroll-contain px-5 py-1.5">
                {cart.length === 0 ? (
                    <div className="text-text/74 flex min-h-full flex-col items-center justify-center gap-1 px-2 pt-3.5 pb-[18px] text-center">
                        <div className="text-text text-base font-semibold">No items yet</div>
                        <div className="text-[13px]">Tap the menu to start order #{props.nextOrderNo}.</div>
                    </div>
                ) : (
                    cart.map((line) => (
                        <div key={line.key} className="border-divider flex items-center gap-3 border-b py-4">
                            <div className="min-w-0 flex-1">
                                <div className="text-lg leading-[1.2] font-semibold">{line.name}</div>
                                <div className="text-text/74 mt-0.5 text-sm">{line.mods}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    aria-label={`One less ${line.name}`}
                                    onClick={() => props.onQty(line.key, -1)}
                                    className="border-divider size-11 cursor-pointer rounded-full border bg-transparent text-xl"
                                >
                                    −
                                </button>
                                <div className="min-w-[22px] text-center text-lg font-semibold tabular-nums">{line.qty}</div>
                                <button
                                    type="button"
                                    aria-label={`One more ${line.name}`}
                                    onClick={() => props.onQty(line.key, 1)}
                                    className="border-divider size-11 cursor-pointer rounded-full border bg-transparent text-xl"
                                >
                                    +
                                </button>
                            </div>
                            {!orderOnly && (
                                <div className="min-w-[82px] text-right text-lg font-semibold tabular-nums">{peso(line.each * line.qty)}</div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="border-divider border-t bg-neutral-200 px-5 pt-3 pb-3.5">
                {orderOnly ? (
                    <div className="mt-[7px] mb-2.5 flex items-baseline justify-between">
                        <span className="text-[17px] font-semibold">Order summary</span>
                        <span className="text-text/74 text-[13.5px]">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                    </div>
                ) : (
                    <>
                        <TotalRow label="Total sales" value={peso2(totals.gross)} />
                        <TotalRow label="Amount net of VAT" value={peso2(totals.net)} />
                        {props.senior ? (
                            <>
                                <TotalRow label="Less VAT 12%" value={`−${peso2(totals.vat)}`} />
                                <TotalRow label="Less 20% discount" value={`−${peso2(totals.discount)}`} />
                            </>
                        ) : (
                            <TotalRow label="Add VAT 12%" value={peso2(totals.vat)} />
                        )}
                        <label className="mt-[7px] mb-[3px] flex cursor-pointer items-center gap-[7px]">
                            <input
                                type="checkbox"
                                checked={props.senior}
                                onChange={(event) => props.onSenior(event.target.checked)}
                                className="accent-accent size-[22px] flex-none cursor-pointer"
                            />
                            <span className="text-[12.5px]">Senior / PWD — VAT-exempt + 20%</span>
                            {props.senior && <span className="text-accent-700 text-[12.5px] tabular-nums">−{peso2(totals.discount)}</span>}
                        </label>
                        <div className="mt-[7px] mb-2.5 flex items-baseline justify-between">
                            <span className="text-[17px] font-semibold">Total amount due</span>
                            <span className="text-accent-700 text-[26px] font-semibold tabular-nums">{peso2(totals.total)}</span>
                        </div>
                    </>
                )}
                <div className="flex gap-2.5">
                    <button
                        type="button"
                        onClick={props.onVoid}
                        className="rounded-btn border-accent-600 text-accent-700 hover:border-accent-700 hover:bg-accent-200 cursor-pointer border bg-transparent px-[18px] py-3 font-semibold"
                    >
                        Void
                    </button>
                    <button type="button" onClick={props.onCharge} className="btn btn-primary flex-1 p-3 text-[15.5px] font-semibold">
                        {orderOnly ? 'Send order' : `Charge ${peso2(totals.total)}`}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TotalRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="mb-[3px] flex justify-between text-[13.5px]">
            <span className="text-text/74">{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
}
