import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { type ScreenData, type SupplierRow } from '@/lib/inventory';
import { useState } from 'react';

const GRID = 'grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_118px_minmax(0,1.5fr)_96px] gap-2.5';

/**
 * Suppliers, shared by every location: who to call and what they supply.
 */
export function Suppliers({
    data,
    query,
    adding,
    onAddingDone,
    toast,
}: {
    data: ScreenData<'sup'>;
    query: string;
    /** The header's "Add a supplier" was pressed. */
    adding: boolean;
    onAddingDone: () => void;
    toast: (message: string) => void;
}) {
    const [editing, setEditing] = useState<SupplierRow | null>(null);
    const [removing, setRemoving] = useState<SupplierRow | null>(null);
    const { send, processing } = useBackOfficeAction(toast);

    const terms = query.trim().toLowerCase();
    const shown = data.suppliers.filter(
        (supplier) =>
            !terms || `${supplier.name} ${supplier.contact ?? ''} ${supplier.phone ?? ''} ${supplier.supplies ?? ''}`.toLowerCase().includes(terms),
    );
    const open = adding || editing !== null;

    const close = () => {
        setEditing(null);
        onAddingDone();
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="text-text/74 text-[12.5px]">
                {shown.length} {shown.length === 1 ? 'supplier' : 'suppliers'}
            </div>
            <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                <div
                    className={`${GRID} border-divider text-text/74 min-w-[620px] border-b bg-neutral-100 px-[18px] py-[11px] text-[11px] font-bold tracking-[.1em] uppercase`}
                >
                    <div>Supplier</div>
                    <div>Contact person</div>
                    <div>Phone</div>
                    <div>Supplies</div>
                    <div />
                </div>
                {shown.map((supplier) => (
                    <div key={supplier.id} className={`${GRID} border-divider min-w-[620px] items-center border-b px-[18px] py-[13px]`}>
                        <div className="min-w-0 text-sm font-semibold">{supplier.name}</div>
                        <div className="min-w-0 text-[13px]">{supplier.contact ?? 'Unassigned'}</div>
                        <div className="min-w-0 text-[13px] whitespace-nowrap tabular-nums">{supplier.phone ?? '—'}</div>
                        <div className="text-text/74 min-w-0 text-[12.5px]">{supplier.supplies ?? '—'}</div>
                        <div className="flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => setEditing(supplier)}
                                className="border-divider bg-bg rounded-btn hover:border-accent hover:text-accent-800 min-h-8 cursor-pointer border px-2.5 py-[5px] text-[11.5px]"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                aria-label={`Remove ${supplier.name}`}
                                onClick={() => setRemoving(supplier)}
                                className="border-divider rounded-btn text-text/74 hover:border-accent hover:text-accent-800 min-h-8 cursor-pointer border bg-transparent px-[9px] py-[5px] text-[11.5px]"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            {shown.length === 0 && (
                <div className="border-divider bg-surface text-text/74 rounded-md border p-[34px] text-center text-[13.5px]">
                    No suppliers match that search.
                </div>
            )}

            <SupplierSheet
                key={editing?.id ?? (adding ? 'new' : 'closed')}
                open={open}
                supplier={editing}
                busy={processing}
                onClose={close}
                onSave={(fields) =>
                    send(
                        editing ? 'put' : 'post',
                        editing ? route('inventory.suppliers.update', editing.id) : route('inventory.suppliers.store'),
                        fields,
                        {
                            success: `${fields.name} ${editing ? 'updated' : 'added'}`,
                            onSuccess: close,
                        },
                    )
                }
            />
            <ConfirmDialog
                open={removing !== null}
                title="Remove this supplier?"
                body={
                    removing
                        ? `${removing.name} · ${removing.contact ?? 'Unassigned'} · ${removing.phone ?? '—'}. Its items keep their stock but lose the supplier.`
                        : ''
                }
                cancelLabel="Keep it"
                confirmLabel="Remove"
                onCancel={() => setRemoving(null)}
                onConfirm={() =>
                    removing &&
                    send(
                        'delete',
                        route('inventory.suppliers.destroy', removing.id),
                        {},
                        { success: `${removing.name} removed`, onSuccess: () => setRemoving(null) },
                    )
                }
            />
        </div>
    );
}

function SupplierSheet({
    open,
    supplier,
    busy,
    onClose,
    onSave,
}: {
    open: boolean;
    supplier: SupplierRow | null;
    busy: boolean;
    onClose: () => void;
    onSave: (fields: { name: string; contact: string | null; phone: string | null; supplies: string | null }) => void;
}) {
    const [fields, setFields] = useState({
        name: supplier?.name ?? '',
        contact: supplier?.contact ?? '',
        phone: supplier?.phone ?? '',
        supplies: supplier?.supplies ?? '',
    });
    const inputs: { key: keyof typeof fields; label: string; placeholder: string }[] = [
        { key: 'name', label: 'Supplier name', placeholder: 'e.g. Bicol Trading' },
        { key: 'contact', label: 'Contact person', placeholder: 'Who to call' },
        { key: 'phone', label: 'Phone', placeholder: '0917 000 0000' },
        { key: 'supplies', label: 'Supplies', placeholder: 'e.g. Dairy · Baking' },
    ];

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={supplier ? 'Edit supplier' : 'Add a supplier'}
            description={supplier ? 'Changes apply everywhere this supplier is shown.' : 'Suppliers are shared across both stores.'}
            width="max-w-[440px]"
        >
            <div className="flex flex-col gap-3.5">
                {inputs.map((input) => (
                    <div key={input.key} className="field">
                        <label htmlFor={`supplier-${input.key}`}>{input.label}</label>
                        <input
                            id={`supplier-${input.key}`}
                            className="input w-full"
                            placeholder={input.placeholder}
                            value={fields[input.key]}
                            onChange={(event) => setFields({ ...fields, [input.key]: event.target.value })}
                        />
                    </div>
                ))}
            </div>
            <div className="mt-6 flex gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary flex-none px-[18px] py-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy || !fields.name.trim()}
                    onClick={() =>
                        onSave({
                            name: fields.name.trim(),
                            contact: fields.contact.trim() || null,
                            phone: fields.phone.trim() || null,
                            supplies: fields.supplies.trim() || null,
                        })
                    }
                    className="btn btn-primary flex-1 p-3 text-sm font-semibold disabled:opacity-50"
                >
                    {supplier ? 'Save supplier' : 'Add supplier'}
                </button>
            </div>
        </Sheet>
    );
}
