import { Sheet } from '@/components/till/sheet';
import { type CartLine } from '@/lib/till';

interface SendSheetProps {
    context: string;
    cart: CartLine[];
    note: string;
    onNote: (note: string) => void;
    processing: boolean;
    onBack: () => void;
    onSend: () => void;
}

/**
 * The Branch Menu's last step: check the items, add a note, and send the order and ticket to the cashier.
 */
export function SendSheet({ context, cart, note, onNote, processing, onBack, onSend }: SendSheetProps) {
    return (
        <Sheet open onClose={onBack} title="Send this order" description={context}>
            <div className="bg-surface mb-5 rounded-md px-5 py-3.5">
                {cart.map((line) => (
                    <div key={line.key} className="border-divider flex gap-2.5 border-b py-[7px] text-sm last:border-b-0">
                        <span className="min-w-7 font-semibold tabular-nums">{line.qty}×</span>
                        <span>
                            {line.name}
                            <span className="text-text/74"> {line.mods}</span>
                        </span>
                    </div>
                ))}
            </div>
            <div className="field mb-[18px]">
                <label htmlFor="order-note">Order note (optional)</label>
                <input
                    id="order-note"
                    className="input w-full"
                    maxLength={200}
                    placeholder="e.g. 25% sugar, no ice, extra hot"
                    value={note}
                    onChange={(event) => onNote(event.target.value)}
                />
            </div>
            <p className="text-text/74 mb-[18px] text-[13px]">The cashier takes payment at the till. This sends the order and its ticket number.</p>
            <div className="flex gap-2.5">
                <button type="button" onClick={onBack} className="btn btn-secondary px-[22px] py-[15px] font-semibold">
                    Back
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={onSend}
                    className="btn btn-primary flex-1 p-[15px] text-base font-semibold disabled:opacity-60"
                >
                    Send to cashier
                </button>
            </div>
        </Sheet>
    );
}
