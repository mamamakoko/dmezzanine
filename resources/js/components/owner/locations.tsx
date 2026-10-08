import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { choiceClass, Sheet } from '@/components/till/sheet';
import { KIND_LABELS, STATUS_LABELS, type LocationKind, type LocationRow, type LocationStatus, type OwnerProps } from '@/lib/owner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/**
 * Locations: each branch, the warehouse and the commissary, with their manager and staff.
 */
export function Locations({ data, toast }: { data: OwnerProps; toast: (message: string) => void }) {
    const [editing, setEditing] = useState<LocationRow | 'new' | null>(null);
    const { send, processing } = useBackOfficeAction(toast);
    const location = editing === 'new' ? null : editing;

    return (
        <div className="motion-safe:animate-tin grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
            {data.locations.map((row) => (
                <div
                    key={row.id}
                    className={cn('border-divider bg-surface flex flex-col gap-0.5 rounded-md border p-5', row.status === 'archived' && 'opacity-60')}
                >
                    <div className="flex items-start gap-2.5">
                        <div className="min-w-0 flex-1">
                            <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">{KIND_LABELS[row.kind]}</div>
                            <h4 className="mt-[3px] mb-0 text-base">{row.name}</h4>
                        </div>
                        <span
                            className={cn(
                                'rounded-btn px-[9px] py-[3px] text-[11.5px] whitespace-nowrap',
                                row.status === 'open' ? 'bg-accent-2-200 text-accent-2-900' : 'bg-neutral-200 text-neutral-800',
                            )}
                        >
                            {STATUS_LABELS[row.status]}
                        </span>
                    </div>
                    <div className="text-text/74 mt-2 text-[13px]">{row.address ?? 'Address to follow'}</div>
                    <div className="mt-4 flex gap-6">
                        <div>
                            <div className="text-lg font-semibold">{row.items}</div>
                            <div className="text-[11.5px] opacity-55">SKUs tracked</div>
                        </div>
                        <div>
                            <div className="text-lg font-semibold">{row.staff}</div>
                            <div className="text-[11.5px] opacity-55">Staff</div>
                        </div>
                    </div>
                    <div className="bg-divider mt-4 mb-3 h-px" />
                    <div className="flex items-center gap-2.5">
                        <div className="min-w-0 flex-1 truncate text-[12.5px]">
                            <span className="opacity-55">Manager</span> {row.manager ?? 'Unassigned'}
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditing(row)}
                            className="border-divider bg-bg rounded-btn hover:border-accent min-h-8 cursor-pointer border px-3 py-1.5 text-xs"
                        >
                            Settings
                        </button>
                    </div>
                </div>
            ))}
            <button
                type="button"
                onClick={() => setEditing('new')}
                className="border-accent-400 text-accent-700 flex min-h-[210px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed bg-transparent p-5"
            >
                <div className="bg-accent-200 flex size-11 items-center justify-center rounded-full text-lg leading-none">+</div>
                <div className="text-[15px] font-semibold">Add a location</div>
                <div className="max-w-[26ch] text-center text-xs opacity-70">
                    New branches start with the first branch's menu, payment methods and count list
                </div>
            </button>

            <LocationSheet
                key={location?.id ?? (editing ? 'new' : 'closed')}
                open={editing !== null}
                location={location}
                data={data}
                busy={processing}
                onClose={() => setEditing(null)}
                onSave={(fields) =>
                    send(
                        location ? 'put' : 'post',
                        location ? route('owner.locations.update', location.id) : route('owner.locations.store'),
                        fields,
                        {
                            success:
                                location && fields.status === 'archived'
                                    ? `${fields.name} archived`
                                    : `${fields.name} ${location ? 'updated' : 'added'}`,
                            onSuccess: () => setEditing(null),
                        },
                    )
                }
            />
        </div>
    );
}

type LocationFields = {
    kind: LocationKind;
    name: string;
    address: string | null;
    manager_id: number | null;
    status: LocationStatus;
};

/**
 * Add a location, or rename, reassign, close or archive one. A location's type is fixed once added.
 */
function LocationSheet({
    open,
    location,
    data,
    busy,
    onClose,
    onSave,
}: {
    open: boolean;
    location: LocationRow | null;
    data: OwnerProps;
    busy: boolean;
    onClose: () => void;
    onSave: (fields: LocationFields) => void;
}) {
    const [fields, setFields] = useState({
        kind: location?.kind ?? ('branch' as LocationKind),
        name: location?.name ?? '',
        address: location?.address ?? '',
        manager_id: location?.manager_id ?? null,
        status: location?.status ?? ('open' as LocationStatus),
    });
    const taken = (kind: LocationKind) => kind !== 'branch' && data.locations.some((row) => row.kind === kind);
    const managers = data.users.filter((user) => user.active || user.id === location?.manager_id);

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={location ? 'Location settings' : 'Add a location'}
            description={
                location
                    ? 'Rename, reassign or archive this location.'
                    : "A new branch starts with the first branch's menu, payment methods and count list."
            }
            width="max-w-[430px]"
        >
            <div className="flex flex-col gap-3.5">
                <div className="field">
                    <label>Type</label>
                    {location ? (
                        <div className="text-sm">{KIND_LABELS[location.kind]}</div>
                    ) : (
                        <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(KIND_LABELS) as LocationKind[]).map((kind) => (
                                <button
                                    key={kind}
                                    type="button"
                                    disabled={taken(kind)}
                                    title={taken(kind) ? `There is already a ${kind}.` : undefined}
                                    aria-pressed={fields.kind === kind}
                                    onClick={() => setFields({ ...fields, kind })}
                                    className={cn(
                                        choiceClass(fields.kind === kind),
                                        'px-[13px] py-[7px] text-[12.5px] disabled:cursor-not-allowed disabled:opacity-45',
                                    )}
                                >
                                    {KIND_LABELS[kind]}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="field">
                    <label htmlFor="location-name">Name</label>
                    <input
                        id="location-name"
                        className="input w-full"
                        placeholder="e.g. DMC-Naga Branch"
                        value={fields.name}
                        onChange={(event) => setFields({ ...fields, name: event.target.value })}
                    />
                </div>
                <div className="field">
                    <label htmlFor="location-address">Address</label>
                    <input
                        id="location-address"
                        className="input w-full"
                        placeholder="Street, city"
                        value={fields.address}
                        onChange={(event) => setFields({ ...fields, address: event.target.value })}
                    />
                </div>
                <div className="field">
                    <label htmlFor="location-manager">Manager</label>
                    <select
                        id="location-manager"
                        className="input w-full cursor-pointer"
                        value={fields.manager_id ?? ''}
                        onChange={(event) => setFields({ ...fields, manager_id: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">Unassigned</option>
                        {managers.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name} · {user.role}
                            </option>
                        ))}
                    </select>
                </div>
                {location && (
                    <div className="field">
                        <label>Status</label>
                        <div className="flex flex-wrap gap-1.5">
                            {(Object.keys(STATUS_LABELS) as LocationStatus[]).map((status) => (
                                <button
                                    key={status}
                                    type="button"
                                    aria-pressed={fields.status === status}
                                    onClick={() => setFields({ ...fields, status })}
                                    className={cn(choiceClass(fields.status === status), 'px-[13px] py-[7px] text-[12.5px]')}
                                >
                                    {STATUS_LABELS[status]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="mt-6 flex gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary flex-none px-[18px] py-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy || !fields.name.trim()}
                    onClick={() => onSave({ ...fields, name: fields.name.trim(), address: fields.address.trim() || null })}
                    className="btn btn-primary flex-1 p-3 text-sm font-semibold disabled:opacity-50"
                >
                    {location ? 'Save changes' : 'Add location'}
                </button>
            </div>
        </Sheet>
    );
}
