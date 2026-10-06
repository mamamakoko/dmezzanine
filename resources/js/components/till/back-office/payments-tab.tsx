import { RemoveButton, SectionLabel, Toggle, useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { PAYMENT_KINDS, shortBranch, type PaymentMethodRow, type TabData } from '@/lib/back-office';
import { peso, type PaymentKind } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function describe(method: PaymentMethodRow): string {
    const bits: string[] = [];

    if (method.kind === 'card' && method.terminal) {
        bits.push(method.terminal);
    }

    if (method.kind === 'qr' && method.wallets) {
        bits.push(method.wallets);
    }

    if (method.kind === 'tab') {
        bits.push(
            method.tab_limit ? `Limit ${peso(method.tab_limit)}` : 'No limit',
            method.lead_only ? 'Branch lead or Owner opens' : 'Any cashier opens',
        );
    }

    bits.push(method.kind === 'tab' ? "Can't be split" : method.split ? 'Can be split' : 'Not in split');

    return [PAYMENT_KINDS.find((kind) => kind.value === method.kind)?.label, ...bits].join(' · ');
}

/**
 * Till settings: this branch's payment methods and the log of who changed them.
 */
export function PaymentsTab({ data, branchName, toast }: { data: TabData<'payments'>; branchName: string; toast: (message: string) => void }) {
    const { send, processing } = useBackOfficeAction(toast);
    const [editing, setEditing] = useState<PaymentMethodRow | 'new' | null>(null);
    const [removing, setRemoving] = useState<PaymentMethodRow | null>(null);
    const branch = shortBranch(branchName);

    return (
        <div>
            <div className="mb-[18px] flex flex-wrap items-center gap-3">
                <div className="text-text/74 min-w-[220px] flex-1 text-[13.5px]">
                    These settings apply to {branch} only. Other branches keep their own methods.
                </div>
                <button type="button" onClick={() => setEditing('new')} className="btn btn-primary px-[22px] py-3 font-semibold">
                    New method
                </button>
            </div>

            <SectionLabel>Payment methods</SectionLabel>
            <div className="mb-7 flex flex-col gap-2">
                {data.methods.map((method) => (
                    <div
                        key={method.id}
                        className="border-divider flex flex-wrap items-center gap-3.5 rounded-md border bg-neutral-100 px-[18px] py-3"
                    >
                        <div className={cn('min-w-0 flex-1', !method.active && 'opacity-60')}>
                            <div className="text-base font-semibold">{method.name}</div>
                            <div className="text-text/74 text-[12.5px]">{describe(method)}</div>
                        </div>
                        <Toggle
                            on={method.active}
                            label={`${method.name} ${method.active ? 'on' : 'off'}`}
                            disabled={processing}
                            onToggle={() =>
                                send(
                                    'patch',
                                    route('pos.payment-methods.toggle', method.id),
                                    { active: !method.active },
                                    { success: `${method.name} switched ${method.active ? 'off' : 'on'} at ${branch}` },
                                )
                            }
                        />
                        <button
                            type="button"
                            onClick={() => setEditing(method)}
                            className="btn btn-secondary min-h-10 px-4 text-[13.5px] font-semibold"
                        >
                            Edit
                        </button>
                        <RemoveButton label={`Remove ${method.name}`} onClick={() => setRemoving(method)} />
                    </div>
                ))}
            </div>

            <SectionLabel>Recent changes</SectionLabel>
            {data.log.length === 0 && <p className="text-text/74 m-0 text-[13.5px]">No changes yet.</p>}
            <div className="flex flex-col">
                {data.log.map((entry) => (
                    <div key={entry.id} className="border-divider flex items-baseline gap-4 border-b py-[9px] text-[13.5px]">
                        <div className="min-w-0 flex-1">
                            <span className="font-semibold">{entry.who}</span> {entry.text}
                        </div>
                        <div className="text-text/74 text-[12.5px] tabular-nums">
                            {new Date(entry.when).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <PaymentMethodSheet
                    method={editing === 'new' ? null : editing}
                    branch={branch}
                    processing={processing}
                    onClose={() => setEditing(null)}
                    onSave={(payload) =>
                        editing === 'new'
                            ? send('post', route('pos.payment-methods.store'), payload, {
                                  success: `${payload.name} added`,
                                  onSuccess: () => setEditing(null),
                              })
                            : send('put', route('pos.payment-methods.update', editing.id), payload, {
                                  success: `${payload.name} saved`,
                                  onSuccess: () => setEditing(null),
                              })
                    }
                />
            )}

            <ConfirmDialog
                open={removing !== null}
                title={`Remove ${removing?.name}?`}
                body={`It comes off the till at ${branch}. Past sales keep the method's name.`}
                cancelLabel="Keep it"
                confirmLabel="Remove"
                onCancel={() => setRemoving(null)}
                onConfirm={() => {
                    if (removing) {
                        send('delete', route('pos.payment-methods.destroy', removing.id), {}, { success: `${removing.name} removed` });
                    }

                    setRemoving(null);
                }}
            />
        </div>
    );
}

interface MethodPayload {
    name: string;
    kind: PaymentKind;
    note: string;
    split: boolean;
    terminal: string;
    wallets: string;
    tab_limit: string;
    lead_only: boolean;
    [key: string]: unknown;
}

function PaymentMethodSheet({
    method,
    branch,
    processing,
    onClose,
    onSave,
}: {
    method: PaymentMethodRow | null;
    branch: string;
    processing: boolean;
    onClose: () => void;
    onSave: (payload: MethodPayload) => void;
}) {
    const [form, setForm] = useState<MethodPayload>({
        name: method?.name ?? '',
        kind: method?.kind ?? 'other',
        note: method?.note ?? '',
        split: method?.split ?? true,
        terminal: method?.terminal ?? '',
        wallets: method?.wallets ?? '',
        tab_limit: method?.tab_limit ? String(method.tab_limit) : '',
        lead_only: method?.lead_only ?? true,
    });
    const set = (patch: Partial<MethodPayload>) => setForm((current) => ({ ...current, ...patch }));
    const chip = (on: boolean) =>
        cn(
            'rounded-btn min-h-10 cursor-pointer border px-3.5 text-[13px] font-semibold',
            on ? 'border-neutral-900 bg-neutral-900 text-neutral-100' : 'border-divider text-text bg-neutral-100',
        );
    const placeholder =
        form.kind === 'card'
            ? 'Insert or tap on the terminal. Waiting for authorisation.'
            : form.kind === 'qr'
              ? 'Customer scans the D-Mezzanine QR, then show the confirmation screen.'
              : form.kind === 'tab'
                ? 'Settle at the counter before leaving.'
                : 'What the cashier should check before marking paid';

    return (
        <Sheet
            open
            onClose={onClose}
            title={method ? `Edit ${method.name}` : 'New payment method'}
            description={`Applies to ${branch} only.`}
            width="max-w-[560px]"
        >
            <div className="field mb-[18px]">
                <label htmlFor="pm-name">Name on the till</label>
                <input
                    id="pm-name"
                    className="input w-full"
                    maxLength={40}
                    placeholder="Bank transfer"
                    value={form.name}
                    onChange={(event) => set({ name: event.target.value })}
                />
            </div>
            <SectionLabel>How it's taken</SectionLabel>
            <div className="mb-[18px] flex flex-wrap gap-1.5">
                {PAYMENT_KINDS.map((kind) => (
                    <button key={kind.value} type="button" onClick={() => set({ kind: kind.value })} className={chip(form.kind === kind.value)}>
                        {kind.label}
                    </button>
                ))}
            </div>
            {form.kind === 'card' && (
                <div className="field mb-[18px]">
                    <label htmlFor="pm-terminal">Terminal</label>
                    <input
                        id="pm-terminal"
                        className="input w-full"
                        placeholder="Counter card terminal"
                        value={form.terminal}
                        onChange={(event) => set({ terminal: event.target.value })}
                    />
                </div>
            )}
            {form.kind === 'qr' && (
                <div className="field mb-[18px]">
                    <label htmlFor="pm-wallets">Wallets accepted</label>
                    <input
                        id="pm-wallets"
                        className="input w-full"
                        placeholder="GCash, Maya"
                        value={form.wallets}
                        onChange={(event) => set({ wallets: event.target.value })}
                    />
                </div>
            )}
            {form.kind === 'tab' && (
                <div className="mb-[18px] flex flex-wrap gap-3.5">
                    <div className="field w-40">
                        <label htmlFor="pm-limit">Limit per tab (₱)</label>
                        <input
                            id="pm-limit"
                            className="input w-full tabular-nums"
                            inputMode="numeric"
                            placeholder="No limit"
                            value={form.tab_limit}
                            onChange={(event) => set({ tab_limit: event.target.value.replace(/[^0-9.]/g, '') })}
                        />
                    </div>
                    <div>
                        <SectionLabel className="mb-[7px]">Who can open a tab</SectionLabel>
                        <div className="flex gap-1.5">
                            <button type="button" onClick={() => set({ lead_only: false })} className={chip(!form.lead_only)}>
                                Any cashier
                            </button>
                            <button type="button" onClick={() => set({ lead_only: true })} className={chip(form.lead_only)}>
                                Branch lead or Owner
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="field mb-[18px]">
                <label htmlFor="pm-note">Till instructions</label>
                <input
                    id="pm-note"
                    className="input w-full"
                    maxLength={300}
                    placeholder={placeholder}
                    value={form.note}
                    onChange={(event) => set({ note: event.target.value })}
                />
            </div>
            {form.kind !== 'tab' && (
                <label className="mb-[22px] flex cursor-pointer items-center gap-2.5 text-sm">
                    <input type="checkbox" checked={form.split} onChange={() => set({ split: !form.split })} className="accent-accent size-[22px]" />
                    <span>Can be part of a split payment</span>
                </label>
            )}
            <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary px-[22px] py-[13px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={() => onSave(form)}
                    className="btn btn-primary px-[26px] py-[13px] font-semibold disabled:opacity-60"
                >
                    Save method
                </button>
            </div>
        </Sheet>
    );
}
