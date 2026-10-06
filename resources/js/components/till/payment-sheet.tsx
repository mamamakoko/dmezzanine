import { choiceClass, Sheet } from '@/components/till/sheet';
import { cashQuickAmounts, orderTotals, peso, peso2, type PaymentInput, type TillPaymentMethod } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface PaymentSheetProps {
    /** e.g. "Dine-in · Ticket 05 · 3 items". */
    context: string;
    /** Total sales before any senior/PWD discount. */
    gross: number;
    senior: boolean;
    /** When set, the cashier can switch the senior/PWD discount on here (settling an unpaid order). */
    onSenior?: (senior: boolean) => void;
    /** The branch's payment methods that are switched on. */
    methods: TillPaymentMethod[];
    canOpenRestrictedTabs: boolean;
    /** The order note, when it can still be written (a new order). */
    note?: { value: string; onChange: (note: string) => void };
    processing: boolean;
    onBack: () => void;
    onMessage: (message: string) => void;
    onSubmit: (payment: PaymentInput) => void;
}

interface SplitPart {
    methodId: number;
    amount: string;
}

const amountText = (raw: string) => raw.replace(/[^0-9.]/g, '');

/**
 * Take payment: amount due, then the branch's own payment methods. Cash offers quick amounts and shows
 * the change; card, QR and other methods show their instructions; a tab asks who it is charged to; and a
 * split spreads the amount over the methods that can be split. The server checks every rule again.
 */
export function PaymentSheet({
    context,
    gross,
    senior,
    onSenior,
    methods,
    canOpenRestrictedTabs,
    note,
    processing,
    onBack,
    onMessage,
    onSubmit,
}: PaymentSheetProps) {
    const [methodId, setMethodId] = useState(methods[0]?.id);
    const [tender, setTender] = useState('');
    const [tabName, setTabName] = useState('');
    const [split, setSplit] = useState(false);
    const [parts, setParts] = useState<SplitPart[]>([]);

    const due = orderTotals(gross, senior).total;
    const method = methods.find((candidate) => candidate.id === methodId);
    const splittable = methods.filter((candidate) => candidate.split && candidate.kind !== 'tab');
    const paid = Math.round(parts.reduce((sum, part) => sum + (parseFloat(part.amount) || 0), 0) * 100) / 100;
    const tendered = parseFloat(tender) || 0;

    const setPart = (index: number, patch: Partial<SplitPart>) =>
        setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));

    const toggleSplit = () => {
        if (!split && splittable.length < 2) {
            onMessage('Split needs two payment methods that can be split');

            return;
        }

        setSplit(!split);
        setParts(split ? [] : splittable.slice(0, 2).map((candidate) => ({ methodId: candidate.id, amount: '' })));
    };

    const submit = () => {
        if (split) {
            onSubmit({ split: true, parts: parts.map((part) => ({ payment_method_id: part.methodId, amount: part.amount })) });
        } else if (method) {
            onSubmit({
                split: false,
                payment_method_id: method.id,
                ...(method.kind === 'cash' ? { tendered: tender } : {}),
                ...(method.kind === 'tab' ? { tab_name: tabName } : {}),
            });
        }
    };

    const cta = split ? 'Charge split' : method?.kind === 'cash' ? 'Confirm cash payment' : method?.kind === 'tab' ? 'Open tab' : 'Mark as paid';

    return (
        <Sheet open onClose={onBack} title="Take payment" description={context} width="max-w-[560px]">
            <div className="bg-surface mb-5 flex items-baseline justify-between rounded-md px-5 py-4">
                <span className="text-[17px] font-semibold">Amount due</span>
                <span className="text-accent-700 text-[34px] font-semibold tabular-nums">{peso2(due)}</span>
            </div>

            {onSenior && (
                <label className="mb-[18px] flex cursor-pointer items-center gap-[7px]">
                    <input
                        type="checkbox"
                        checked={senior}
                        onChange={(event) => {
                            onSenior(event.target.checked);
                            setTender('');
                        }}
                        className="accent-accent size-[22px] flex-none cursor-pointer"
                    />
                    <span className="text-[13px]">Senior / PWD — VAT-exempt + 20%</span>
                </label>
            )}

            <div className="mb-2.5 flex items-center justify-between">
                <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">{split ? 'Split across payments' : 'Payment method'}</div>
                <button
                    type="button"
                    onClick={toggleSplit}
                    className="rounded-btn border-accent-300 bg-accent/8 text-accent-700 active:bg-accent/18 inline-flex min-h-11 cursor-pointer items-center border px-[18px] text-sm font-semibold"
                >
                    {split ? 'Single payment' : 'Split payment'}
                </button>
            </div>

            {split ? (
                <div className="mb-[18px]">
                    <div className="bg-surface mb-3 flex gap-[18px] rounded-md px-4 py-3 text-[13px]">
                        <span className="text-text/74">
                            Paid <strong className="text-text font-semibold tabular-nums">{peso(paid)}</strong>
                        </span>
                        <span className="text-text/74">
                            Remaining{' '}
                            <strong className={cn('font-semibold tabular-nums', paid >= due ? 'text-accent-2-700' : 'text-accent-700')}>
                                {peso(Math.max(0, due - paid))}
                            </strong>
                        </span>
                        <div className="flex-1" />
                        {paid > due && <span className="text-text/74 tabular-nums">Change {peso(paid - due)}</span>}
                    </div>
                    <div className="mb-3 flex flex-col gap-[9px]">
                        {parts.map((part, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="flex min-w-0 flex-1 gap-[5px]">
                                    {splittable.map((candidate) => (
                                        <button
                                            key={candidate.id}
                                            type="button"
                                            onClick={() => setPart(index, { methodId: candidate.id })}
                                            className={choiceClass(part.methodId === candidate.id) + ' min-h-11 flex-1 px-1.5 text-[12.5px]'}
                                        >
                                            {candidate.name}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    className="input w-24 text-right tabular-nums"
                                    aria-label={`Amount for payment ${index + 1}`}
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={part.amount}
                                    onChange={(event) => setPart(index, { amount: amountText(event.target.value) })}
                                />
                                <button
                                    type="button"
                                    title="Fill remaining"
                                    aria-label="Fill the remaining amount"
                                    onClick={() =>
                                        setPart(index, {
                                            amount: String(Math.max(0, Math.round((due - (paid - (parseFloat(part.amount) || 0))) * 100) / 100)),
                                        })
                                    }
                                    className="border-divider hover:border-accent hover:text-accent-700 size-10 flex-none cursor-pointer rounded-full border bg-transparent text-[13px]"
                                >
                                    ↧
                                </button>
                                <button
                                    type="button"
                                    title="Remove"
                                    aria-label="Remove this payment"
                                    onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                                    className="border-divider hover:border-accent hover:text-accent-700 size-10 flex-none cursor-pointer rounded-full border bg-transparent text-sm"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() =>
                            setParts((current) => [
                                ...current,
                                { methodId: splittable[0].id, amount: String(Math.max(0, Math.round((due - paid) * 100) / 100)) },
                            ])
                        }
                        className="btn btn-secondary px-5 py-[11px] text-[13.5px] font-semibold"
                    >
                        Add payment
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-[18px] flex flex-wrap gap-2">
                        {methods.map((candidate) => (
                            <button
                                key={candidate.id}
                                type="button"
                                onClick={() => {
                                    setMethodId(candidate.id);
                                    setTender('');
                                }}
                                className={cn(
                                    'min-h-11 flex-1 cursor-pointer rounded-md border-2 px-2.5 py-[15px] text-[14.5px] font-semibold',
                                    methodId === candidate.id
                                        ? 'border-accent bg-accent-200 text-accent-800'
                                        : 'border-divider text-text bg-neutral-100',
                                )}
                            >
                                {candidate.name}
                            </button>
                        ))}
                    </div>

                    {method?.kind === 'cash' && (
                        <div className="mb-5">
                            <div className="text-text/74 mb-[9px] text-[11.5px] tracking-[.08em] uppercase">Cash tendered</div>
                            <div className="mb-3 flex gap-2">
                                {cashQuickAmounts(due).map((amount) => (
                                    <button
                                        key={amount}
                                        type="button"
                                        onClick={() => setTender(String(amount))}
                                        className={choiceClass(tendered === amount) + ' min-h-11 flex-1 px-1.5 py-[13px] text-sm tabular-nums'}
                                    >
                                        {Number.isInteger(amount) ? peso(amount) : peso2(amount)}
                                    </button>
                                ))}
                            </div>
                            <input
                                className="input mb-3 w-full text-right text-lg font-semibold tabular-nums"
                                aria-label="Cash received"
                                inputMode="decimal"
                                placeholder="Or type the amount received"
                                value={tender}
                                onChange={(event) => setTender(amountText(event.target.value))}
                            />
                            <div className="flex justify-between text-[15px]">
                                <span className="text-text/74">Change due</span>
                                <span className="text-[19px] font-semibold tabular-nums">{peso2(Math.max(0, tendered - due))}</span>
                            </div>
                        </div>
                    )}

                    {method && ['card', 'qr', 'other'].includes(method.kind) && (
                        <div className="bg-accent-2-100 border-accent-2-300 mb-5 rounded-md border p-4 text-[13.5px]">{instructions(method)}</div>
                    )}

                    {method?.kind === 'tab' && (
                        <div className="bg-accent-100 border-accent-300 mb-5 rounded-md border px-[18px] py-4">
                            <div className="field mb-2.5">
                                <label htmlFor="tab-name">Charge to</label>
                                <input
                                    id="tab-name"
                                    className="input w-full"
                                    placeholder="Customer or table name"
                                    value={tabName}
                                    onChange={(event) => setTabName(event.target.value)}
                                />
                            </div>
                            <div className="text-text/74 text-[13px]">
                                The order goes to the kitchen now and sits on the queue as unpaid until settled.
                            </div>
                            <div className="text-accent-800 mt-1.5 text-[12.5px] font-semibold">
                                {method.tab_limit ? `Limit ${peso(method.tab_limit)}` : 'No limit'} ·{' '}
                                {method.lead_only ? 'Branch lead or Owner only' : 'Any cashier can open'}
                                {method.lead_only && !canOpenRestrictedTabs && ' — ask your Branch lead'}
                            </div>
                        </div>
                    )}
                </>
            )}

            {note && (
                <div className="field mb-[18px]">
                    <label htmlFor="order-note">Order note (optional)</label>
                    <input
                        id="order-note"
                        className="input w-full"
                        maxLength={200}
                        placeholder="e.g. 25% sugar, no ice, extra hot"
                        value={note.value}
                        onChange={(event) => note.onChange(event.target.value)}
                    />
                </div>
            )}

            <div className="flex gap-2.5">
                <button type="button" onClick={onBack} className="btn btn-secondary px-[22px] py-[15px] font-semibold">
                    Back
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={submit}
                    className="btn btn-primary flex-1 p-[15px] text-base font-semibold disabled:opacity-60"
                >
                    {cta}
                </button>
            </div>
        </Sheet>
    );
}

/** What the cashier should do before marking a card, QR or other payment as paid. */
function instructions(method: TillPaymentMethod): string {
    if (method.note) {
        return method.note;
    }

    if (method.kind === 'card') {
        return `Insert or tap on the ${method.terminal || 'card terminal'}. Waiting for authorisation.`;
    }

    if (method.kind === 'qr') {
        return `Customer scans the D-Mezzanine QR${method.wallets ? ` (${method.wallets})` : ''}, then show the confirmation screen.`;
    }

    return 'Confirm the payment was received, then mark as paid.';
}
