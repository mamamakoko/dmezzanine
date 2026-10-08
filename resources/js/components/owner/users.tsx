import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { initials, roleTone, stamp, type OwnerProps, type UserRow } from '@/lib/owner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const GRID = 'grid grid-cols-[minmax(150px,1.5fr)_minmax(84px,132px)_minmax(96px,160px)_minmax(80px,132px)_minmax(190px,250px)] gap-2.5';

/**
 * Users & access: who can sign in, invites still waiting for a first sign-in, and revoked accounts.
 */
export function Users({
    data,
    query,
    inviting,
    onInvitingDone,
    toast,
}: {
    data: OwnerProps;
    query: string;
    /** The header's "Invite a user" was pressed. */
    inviting: boolean;
    onInvitingDone: () => void;
    toast: (message: string) => void;
}) {
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [resetting, setResetting] = useState<UserRow | null>(null);
    const [revoking, setRevoking] = useState<UserRow | null>(null);
    const { send, processing } = useBackOfficeAction(toast);

    const shown = filterUsers(data.users, query);
    const active = data.users.filter((user) => user.active).length;
    const pending = data.users.filter((user) => user.pending).length;
    const revoked = data.users.filter((user) => !user.active).length;

    const toggle = (user: UserRow) =>
        send(
            'patch',
            route('owner.users.access', user.id),
            {},
            {
                success: user.active ? `Access revoked for ${user.name}` : `Access granted to ${user.name}`,
                onSuccess: () => setRevoking(null),
            },
        );

    const closeSheet = () => {
        setEditing(null);
        onInvitingDone();
    };

    return (
        <div className="flex flex-col">
            <div className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Stat label="Active users" value={active} sub="can sign in today" />
                <Stat label="Invites pending" value={pending} sub={pending ? 'awaiting first sign-in' : 'nothing waiting'} highlight={pending > 0} />
                <Stat label="Revoked" value={revoked} sub="access switched off" />
            </div>

            <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                <div
                    className={`${GRID} text-text/74 min-w-[760px] bg-neutral-100 px-[18px] py-3 text-[11.5px] font-bold tracking-[.07em] uppercase`}
                >
                    <div>User</div>
                    <div>Role</div>
                    <div>Location</div>
                    <div>Last login</div>
                    <div className="justify-self-end">Access</div>
                </div>
                {shown.map((user) => (
                    <div
                        key={user.id}
                        className={cn(`${GRID} border-divider min-w-[760px] items-center border-t px-[18px] py-3`, !user.active && 'opacity-60')}
                    >
                        <div className="flex min-w-0 items-center gap-[11px]">
                            <Avatar user={user} />
                            <div className="min-w-0">
                                <div className="truncate text-sm">{user.name}</div>
                                <div className="text-text/74 truncate text-[11.5px]">{user.email}</div>
                            </div>
                        </div>
                        <div>
                            <span className={cn('rounded-btn px-[9px] py-[3px] text-[11.5px] whitespace-nowrap', roleTone(user.role))}>
                                {user.role}
                            </span>
                        </div>
                        <div className="text-[12.5px]">{user.location}</div>
                        <div className="text-text/74 truncate text-[12.5px]">
                            {user.pending ? 'Invite pending' : user.last_login_at ? stamp(user.last_login_at) : 'Never'}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-[7px] justify-self-end">
                            <button
                                type="button"
                                onClick={() => setEditing(user)}
                                className="border-divider bg-bg rounded-btn hover:border-accent min-h-8 cursor-pointer border px-3 py-1.5 text-xs"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => setResetting(user)}
                                className="border-divider bg-bg rounded-btn hover:border-accent min-h-8 cursor-pointer border px-3 py-1.5 text-xs whitespace-nowrap"
                            >
                                {user.pending ? 'Resend invite' : 'Reset password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => (user.active ? setRevoking(user) : toggle(user))}
                                className={cn(
                                    'rounded-btn min-h-8 cursor-pointer px-[13px] py-[7px] text-xs font-semibold',
                                    user.active ? 'bg-neutral-200 text-neutral-800' : 'bg-accent-2-700 text-neutral-100',
                                )}
                            >
                                {user.active ? 'Revoke' : 'Grant'}
                            </button>
                        </div>
                    </div>
                ))}
                {shown.length === 0 && <div className="text-text/74 p-[34px] text-center text-[13.5px]">No user matches that search.</div>}
            </div>

            <UserSheet
                key={editing?.id ?? (inviting ? 'new' : 'closed')}
                open={inviting || editing !== null}
                user={editing}
                data={data}
                busy={processing}
                onClose={closeSheet}
                onSave={(fields) =>
                    send(editing ? 'put' : 'post', editing ? route('owner.users.update', editing.id) : route('owner.users.store'), fields, {
                        success: editing ? `${fields.name} updated` : undefined,
                        onSuccess: closeSheet,
                    })
                }
            />

            <ResetSheet
                user={resetting}
                busy={processing}
                onClose={() => setResetting(null)}
                onReset={(type) =>
                    resetting && send('post', route('owner.users.credentials', resetting.id), { type }, { onSuccess: () => setResetting(null) })
                }
            />

            <ConfirmDialog
                open={revoking !== null}
                title={`Revoke ${revoking?.name ?? ''}?`}
                body={
                    <>
                        <span className="text-text mb-1.5 block">
                            {revoking?.role} · {revoking?.location}
                        </span>
                        They are signed out of the till and back office immediately. You can grant access again at any time.
                    </>
                }
                cancelLabel="Cancel"
                confirmLabel="Revoke access"
                onCancel={() => setRevoking(null)}
                onConfirm={() => revoking && toggle(revoking)}
            />
        </div>
    );
}

export function filterUsers(users: UserRow[], query: string): UserRow[] {
    const terms = query.trim().toLowerCase();

    return users.filter((user) => !terms || `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(terms));
}

export function Avatar({ user, size = 'size-[34px] text-[13px]' }: { user: UserRow; size?: string }) {
    return (
        <div
            className={cn(
                'flex flex-none items-center justify-center rounded-full font-semibold',
                size,
                user.active ? 'bg-accent-200 text-accent-900' : 'bg-neutral-200 text-neutral-800',
            )}
        >
            {initials(user.name)}
        </div>
    );
}

function Stat({ label, value, sub, highlight = false }: { label: string; value: number; sub: string; highlight?: boolean }) {
    return (
        <div
            className={cn('rounded-md border px-[18px] pt-[18px] pb-4', highlight ? 'border-accent-600 bg-accent-200' : 'border-divider bg-surface')}
        >
            <div className={cn('text-[11.5px] tracking-[.08em] uppercase', highlight ? 'text-accent-900' : 'text-text/74')}>{label}</div>
            <div className={cn('mt-2 text-[27px] leading-[1.05] font-semibold', highlight ? 'text-accent-900' : 'text-text')}>{value}</div>
            <div className={cn('mt-1 text-[12.5px]', highlight ? 'text-accent-800' : 'text-text/74')}>{sub}</div>
        </div>
    );
}

type UserFields = {
    name: string;
    email: string;
    role_id: number;
    branch_id: number | null;
};

/**
 * Invite a user, or change a user's name, email, role and location.
 */
function UserSheet({
    open,
    user,
    data,
    busy,
    onClose,
    onSave,
}: {
    open: boolean;
    user: UserRow | null;
    data: OwnerProps;
    busy: boolean;
    onClose: () => void;
    onSave: (fields: UserFields) => void;
}) {
    const roles = data.roles.filter((role) => role.name !== 'Owner' || data.canMakeOwner || user?.is_owner);
    const [fields, setFields] = useState({
        name: user?.name ?? '',
        email: user?.email ?? '',
        role_id: user?.role_id ?? roles.find((role) => role.name === 'Cashier')?.id ?? roles[0]?.id ?? 0,
        branch_id: user?.branch_id ?? null,
    });
    const locations = data.locations.filter((location) => location.status !== 'archived' || location.id === user?.branch_id);
    const ready = fields.name.trim() !== '' && fields.email.trim() !== '';

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={user ? 'Edit user' : 'Invite a user'}
            description={
                user
                    ? 'Their page access follows the new role, plus any exceptions you have set.'
                    : 'They get a first-time password and till PIN, shown to you once to pass on. Both can be reset here later.'
            }
            width="max-w-[420px]"
        >
            <div className="flex flex-col gap-[13px]">
                <div className="field">
                    <label htmlFor="user-name">Full name</label>
                    <input
                        id="user-name"
                        className="input w-full"
                        placeholder="e.g. Paolo Rivas"
                        value={fields.name}
                        onChange={(event) => setFields({ ...fields, name: event.target.value })}
                    />
                </div>
                <div className="field">
                    <label htmlFor="user-email">Work email</label>
                    <input
                        id="user-email"
                        type="email"
                        className="input w-full"
                        placeholder="name@dmezzanine.ph"
                        value={fields.email}
                        onChange={(event) => setFields({ ...fields, email: event.target.value })}
                    />
                </div>
                <div className="field">
                    <label htmlFor="user-role">Role</label>
                    <select
                        id="user-role"
                        className="input w-full cursor-pointer"
                        value={fields.role_id}
                        onChange={(event) => setFields({ ...fields, role_id: Number(event.target.value) })}
                    >
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="user-location">Location</label>
                    <select
                        id="user-location"
                        className="input w-full cursor-pointer"
                        value={fields.branch_id ?? ''}
                        onChange={(event) => setFields({ ...fields, branch_id: event.target.value ? Number(event.target.value) : null })}
                    >
                        <option value="">All locations</option>
                        {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="mt-[22px] flex gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary flex-1 p-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy || !ready}
                    onClick={() => onSave({ ...fields, name: fields.name.trim(), email: fields.email.trim() })}
                    className="btn btn-primary flex-1 p-3 text-sm font-semibold disabled:opacity-50"
                >
                    {user ? 'Save changes' : 'Send invite'}
                </button>
            </div>
        </Sheet>
    );
}

/**
 * Issue a new password or a new till PIN. The old one stops working straight away.
 */
function ResetSheet({
    user,
    busy,
    onClose,
    onReset,
}: {
    user: UserRow | null;
    busy: boolean;
    onClose: () => void;
    onReset: (type: 'password' | 'pin') => void;
}) {
    return (
        <Sheet
            open={user !== null}
            onClose={onClose}
            title={user?.pending ? `Resend ${user.name}'s invite` : `Reset sign-in for ${user?.name ?? ''}`}
            description="The old one stops working straight away. The new one is shown to you once."
            width="max-w-[420px]"
        >
            <div className="grid gap-2.5">
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReset('password')}
                    className="border-divider bg-surface rounded-btn hover:border-accent cursor-pointer border px-[15px] py-[13px] text-left disabled:opacity-50"
                >
                    <div className="text-sm font-semibold">New password</div>
                    <div className="text-text/74 mt-0.5 text-[12.5px]">For signing in with email and password, where Google sign-in isn't used.</div>
                </button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onReset('pin')}
                    className="border-divider bg-surface rounded-btn hover:border-accent cursor-pointer border px-[15px] py-[13px] text-left disabled:opacity-50"
                >
                    <div className="text-sm font-semibold">New till PIN</div>
                    <div className="text-text/74 mt-0.5 text-[12.5px]">
                        {user?.has_pin
                            ? 'For unlocking the till. No one else on their tills will have it.'
                            : 'They have no PIN yet. This gives them one.'}
                    </div>
                </button>
            </div>
            <button type="button" onClick={onClose} className="btn btn-secondary mt-[18px] w-full p-[11px] text-[13.5px]">
                Cancel
            </button>
        </Sheet>
    );
}
