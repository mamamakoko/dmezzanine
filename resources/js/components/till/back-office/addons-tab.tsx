import { PartsEditor, RemoveButton, SectionLabel, useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { qtyLabel, shortBranch, type AddonRow, type Part, type TabData } from '@/lib/back-office';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/**
 * The shared add-on list. The Owner edits it; a branch switches an add-on on or off for itself.
 */
export function AddonsTab({ data, branchName, toast }: { data: TabData<'addons'>; branchName: string; toast: (message: string) => void }) {
    const { send, processing } = useBackOfficeAction(toast);
    const [editing, setEditing] = useState<AddonRow | 'new' | null>(null);
    const [removing, setRemoving] = useState<AddonRow | null>(null);
    const branch = shortBranch(branchName);
    const stockName = (part: Part) => {
        const item = data.stockItems.find((candidate) => candidate.id === part.stock_item_id);

        return item ? `${item.name} ${qtyLabel(part.qty, item.unit)}` : 'removed item';
    };

    return (
        <div>
            <div className="mb-[18px] flex flex-wrap items-center gap-3">
                <div className="text-text/74 min-w-[220px] flex-1 text-[13.5px]">
                    {data.isOwner
                        ? `You can edit the list and switch add-ons at ${branch}.`
                        : `You can switch add-ons on or off at ${branch}. Only the Owner can change the list or prices.`}
                </div>
                {data.isOwner && (
                    <button type="button" onClick={() => setEditing('new')} className="btn btn-primary px-[22px] py-3 font-semibold">
                        New add-on
                    </button>
                )}
            </div>

            {data.addons.length === 0 && (
                <div className="border-divider text-text/74 rounded-md border bg-neutral-100 p-[34px] text-center text-[13.5px]">
                    No add-ons yet. Drinks go straight to the order without the add-on step.
                </div>
            )}

            <div className="flex flex-col gap-2">
                {data.addons.map((addon) => (
                    <div
                        key={addon.id}
                        className={cn(
                            'border-divider flex flex-wrap items-center gap-4 rounded-md border bg-neutral-100 px-[18px] py-3.5',
                            !addon.on && 'opacity-60',
                        )}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold">{addon.name}</div>
                            <div className="text-text/74 text-[12.5px]">
                                {addon.menu_item_ids.length
                                    ? `Offered on ${addon.menu_item_ids.length} ${addon.menu_item_ids.length === 1 ? 'item' : 'items'}`
                                    : 'Not offered on any item'}{' '}
                                · {addon.parts.length ? addon.parts.map(stockName).join(', ') : 'no stock used'}
                            </div>
                        </div>
                        <div className="min-w-20 text-right text-[17px] font-semibold tabular-nums">
                            {addon.price ? `+${peso(addon.price)}` : 'Free'}
                        </div>
                        <button
                            type="button"
                            disabled={processing}
                            onClick={() =>
                                send(
                                    'put',
                                    route('pos.addons.availability', addon.id),
                                    { on: !addon.on },
                                    { success: `${addon.name} ${addon.on ? 'switched off at' : 'back on at'} ${branch}` },
                                )
                            }
                            className={cn(
                                'border-divider rounded-btn min-h-10 min-w-[124px] cursor-pointer border px-4 text-[13px] font-semibold',
                                addon.on ? 'bg-accent-2-100' : 'bg-surface',
                            )}
                        >
                            {addon.on ? `On at ${branch}` : `Off at ${branch}`}
                        </button>
                        {data.isOwner && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setEditing(addon)}
                                    className="btn btn-secondary min-h-10 px-5 text-[13.5px] font-semibold"
                                >
                                    Edit
                                </button>
                                <RemoveButton label={`Remove ${addon.name}`} onClick={() => setRemoving(addon)} />
                            </>
                        )}
                    </div>
                ))}
            </div>

            {editing && (
                <AddonSheet
                    addon={editing === 'new' ? null : editing}
                    data={data}
                    processing={processing}
                    onClose={() => setEditing(null)}
                    onSave={(payload) =>
                        editing === 'new'
                            ? send('post', route('pos.addons.store'), payload, {
                                  success: `${payload.name} added`,
                                  onSuccess: () => setEditing(null),
                              })
                            : send('put', route('pos.addons.update', editing.id), payload, {
                                  success: `${payload.name} saved`,
                                  onSuccess: () => setEditing(null),
                              })
                    }
                />
            )}

            <ConfirmDialog
                open={removing !== null}
                title={`Remove ${removing?.name}?`}
                body="It comes off every branch's till. Past orders keep it."
                cancelLabel="Keep it"
                confirmLabel="Remove"
                onCancel={() => setRemoving(null)}
                onConfirm={() => {
                    if (removing) {
                        send('delete', route('pos.addons.destroy', removing.id), {}, { success: `${removing.name} removed` });
                    }

                    setRemoving(null);
                }}
            />
        </div>
    );
}

interface AddonPayload {
    name: string;
    price: string;
    parts: Part[];
    menu_item_ids: number[];
    [key: string]: unknown;
}

function AddonSheet({
    addon,
    data,
    processing,
    onClose,
    onSave,
}: {
    addon: AddonRow | null;
    data: TabData<'addons'>;
    processing: boolean;
    onClose: () => void;
    onSave: (payload: AddonPayload) => void;
}) {
    const [form, setForm] = useState<AddonPayload>({
        name: addon?.name ?? '',
        price: addon ? String(addon.price) : '',
        parts: addon?.parts ?? [],
        menu_item_ids: addon?.menu_item_ids ?? [],
    });
    const set = (patch: Partial<AddonPayload>) => setForm((current) => ({ ...current, ...patch }));
    const toggleItems = (ids: number[], on: boolean) =>
        set({ menu_item_ids: on ? [...new Set([...form.menu_item_ids, ...ids])] : form.menu_item_ids.filter((id) => !ids.includes(id)) });

    return (
        <Sheet
            open
            onClose={onClose}
            title={addon ? `Edit ${addon.name}` : 'New add-on'}
            description="Applies to every branch. Branches can still switch it off on their own till."
            width="max-w-[600px]"
        >
            <div className="mb-5 flex gap-3.5">
                <div className="field min-w-0 flex-1">
                    <label htmlFor="ao-name">Name</label>
                    <input
                        id="ao-name"
                        className="input w-full"
                        maxLength={40}
                        placeholder="Caramel drizzle"
                        value={form.name}
                        onChange={(event) => set({ name: event.target.value })}
                    />
                </div>
                <div className="field w-[140px]">
                    <label htmlFor="ao-price">Price (₱)</label>
                    <input
                        id="ao-price"
                        className="input w-full tabular-nums"
                        inputMode="decimal"
                        value={form.price}
                        onChange={(event) => set({ price: event.target.value.replace(/[^0-9.]/g, '') })}
                    />
                </div>
            </div>

            <div className="mb-[22px]">
                <PartsEditor
                    parts={form.parts}
                    stockItems={data.stockItems}
                    onChange={(parts) => set({ parts })}
                    emptyText="Nothing added to the daily count. Add what one serving of this add-on uses."
                />
            </div>

            <div className="mb-2.5 flex items-baseline justify-between">
                <SectionLabel className="mb-0">Offered on</SectionLabel>
                <div className="text-text/74 text-xs">
                    {form.menu_item_ids.length} {form.menu_item_ids.length === 1 ? 'item' : 'items'}
                </div>
            </div>
            <div className="mb-[22px] flex flex-col gap-3.5">
                {data.menuGroups.map((group) => {
                    const ids = group.items.map((item) => item.id);
                    const allOn = ids.every((id) => form.menu_item_ids.includes(id));

                    return (
                        <div key={group.name}>
                            <div className="mb-[7px] flex items-center gap-2.5">
                                <div className="text-[13.5px] font-semibold">{group.name}</div>
                                <button
                                    type="button"
                                    onClick={() => toggleItems(ids, !allOn)}
                                    className="text-accent-700 cursor-pointer bg-transparent px-1.5 py-1 text-[12.5px] font-semibold"
                                >
                                    {allOn ? 'Clear' : 'All'}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {group.items.map((item) => {
                                    const on = form.menu_item_ids.includes(item.id);

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => toggleItems([item.id], !on)}
                                            className={cn(
                                                'rounded-btn min-h-10 cursor-pointer border px-[13px] text-[13px] font-semibold',
                                                on ? 'border-neutral-900 bg-neutral-900 text-neutral-100' : 'border-divider text-text bg-neutral-100',
                                            )}
                                        >
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

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
                    Save add-on
                </button>
            </div>
        </Sheet>
    );
}
