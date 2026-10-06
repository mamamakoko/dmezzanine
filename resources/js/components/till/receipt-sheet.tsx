import { pad2, peso, peso2, type TillOrder } from '@/lib/till';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface ReceiptSheetProps {
    order: TillOrder;
    orderOnly: boolean;
    onPrint: () => void;
    onClose: () => void;
}

/**
 * The receipt after a sale, or the slip after the Branch Menu sends an order.
 */
export function ReceiptSheet({ order, orderOnly, onPrint, onClose }: ReceiptSheetProps) {
    const time = new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    const changeTotal = (order.payments ?? []).reduce((sum, payment) => sum + payment.change, 0);

    return (
        <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="bg-text/45 fixed inset-0 z-[41]" />
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className="font-body text-text motion-safe:animate-tin fixed top-1/2 left-1/2 z-[41] max-h-[92vh] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md bg-neutral-100 shadow-[var(--shadow-lg)]"
                >
                    <div className="bg-accent-2-900 flex items-center justify-between px-[26px] py-[22px] text-neutral-100">
                        <div>
                            <DialogPrimitive.Title className="m-0 text-xl font-semibold">Order #{order.no}</DialogPrimitive.Title>
                            <div className="text-[13px] text-neutral-100/72">
                                {order.service} · Ticket {pad2(order.ticket)} · {time}
                            </div>
                        </div>
                        <div className="bg-accent text-accent-2-900 rounded-md px-3.5 py-2 text-center">
                            <div className="text-[10px] tracking-[.1em] uppercase">Ticket</div>
                            <div className="text-[26px] leading-[1.05] font-semibold tabular-nums">{pad2(order.ticket)}</div>
                        </div>
                    </div>

                    <div className="px-[26px] py-5">
                        <div className="max-h-[300px] overflow-auto overscroll-contain">
                            {order.lines.map((line, index) => (
                                <div key={index} className="border-divider flex justify-between gap-2.5 border-b py-2 text-[13.5px]">
                                    <span>
                                        {line.qty}× {line.name}
                                        {line.mods !== 'No changes' && <span className="text-text/74"> {line.mods}</span>}
                                    </span>
                                    {!orderOnly && <span className="font-semibold tabular-nums">{peso(line.line_total ?? 0)}</span>}
                                </div>
                            ))}
                        </div>

                        {orderOnly ? (
                            <div className="border-divider mt-3.5 flex items-baseline justify-between border-t pt-3">
                                <span className="text-[15px] font-semibold">Sent to the cashier</span>
                                <span className="text-text/74 text-[13px]">Pay at the till</span>
                            </div>
                        ) : (
                            <>
                                {!!order.vat_exempt && <ReceiptRow label="VAT exempt (12%)" value={`−${peso2(order.vat_exempt)}`} first />}
                                {!!order.discount && <ReceiptRow label="Senior / PWD 20% discount" value={`−${peso2(order.discount)}`} />}
                                {(order.payments ?? []).map((payment, index) => (
                                    <ReceiptRow
                                        key={index}
                                        first={index === 0 && !order.vat_exempt}
                                        label={payment.method}
                                        value={peso2(payment.tendered ?? payment.amount)}
                                    />
                                ))}
                                {(order.payments ?? []).length > 0 && <ReceiptRow label="Change" value={peso2(changeTotal)} />}
                                {order.unpaid && (
                                    <ReceiptRow
                                        first
                                        label={order.tab_name ? `Unpaid · tab for ${order.tab_name}` : 'Unpaid'}
                                        value={`Balance due ${peso2(order.total ?? 0)}`}
                                    />
                                )}
                                <div className="border-divider mt-3.5 flex items-baseline justify-between border-t pt-3">
                                    <span className="text-[17px] font-semibold">Total</span>
                                    <span className="text-accent-700 text-[26px] font-semibold tabular-nums">{peso2(order.total ?? 0)}</span>
                                </div>
                            </>
                        )}

                        {order.note && (
                            <div className="bg-accent-2-100 mt-4 rounded-md px-3.5 py-3 text-[12.5px]">
                                <strong className="font-semibold">Note</strong> · {order.note}
                            </div>
                        )}

                        <div className="mt-[18px] flex gap-2.5">
                            <button type="button" onClick={onPrint} className="btn btn-primary flex-1 p-3.5 font-semibold">
                                {orderOnly ? 'Print slip' : 'Print'}
                            </button>
                            <button type="button" onClick={onClose} className="btn btn-secondary flex-1 p-3.5 font-semibold">
                                New order
                            </button>
                        </div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

function ReceiptRow({ label, value, first = false }: { label: string; value: string; first?: boolean }) {
    return (
        <div className={first ? 'mt-3.5 flex justify-between text-[13.5px]' : 'mt-1.5 flex justify-between text-[13.5px]'}>
            <span className="text-text/74">{label}</span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
}
