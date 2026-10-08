/**
 * Types and helpers for the Owner console (App\Http\Controllers\OwnerController).
 */
import { type Area } from '@/lib/workspaces';
import { router } from '@inertiajs/react';

export type Screen = 'users' | 'pages' | 'locations' | 'log';

export type LocationKind = 'branch' | 'warehouse' | 'commissary';

export type LocationStatus = 'open' | 'closed' | 'archived';

export type LogKind = 'stock' | 'req' | 'user' | 'count';

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role_id: number;
    role: string;
    is_owner: boolean;
    branch_id: number | null;
    location: string;
    active: boolean;
    /** Access is on but they haven't signed in yet. */
    pending: boolean;
    last_login_at: string | null;
    has_pin: boolean;
    /** The pages their role and exceptions give them, whether or not access is on. */
    areas: Area[];
}

export interface RoleRow {
    id: number;
    name: string;
    /** The pages the role opens by default. */
    areas: Area[];
}

export interface LocationRow {
    id: number;
    name: string;
    kind: LocationKind;
    address: string | null;
    status: LocationStatus;
    manager_id: number | null;
    manager: string | null;
    items: number;
    staff: number;
}

export interface LogEntry {
    id: string;
    at: string;
    kind: LogKind;
    kind_label: string;
    what: string;
    detail: string | null;
    who: string;
    source: string;
}

/** A new password or PIN, shown to the Owner once. */
export interface Issued {
    title: string;
    name: string;
    email: string;
    who: string;
    password: string | null;
    pin: string | null;
}

export interface OwnerProps {
    screen: Screen;
    users: UserRow[];
    roles: RoleRow[];
    locations: LocationRow[];
    log: { from: string | null; to: string | null; entries: LogEntry[]; limit: number } | null;
    issued: Issued | null;
    canMakeOwner: boolean;
}

export const KIND_LABELS: Record<LocationKind, string> = { branch: 'Branch', warehouse: 'Warehouse', commissary: 'Commissary' };

export const STATUS_LABELS: Record<LocationStatus, string> = { open: 'Open', closed: 'Closed', archived: 'Archived' };

export const initials = (name: string) =>
    name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2);

/** Role chip colours: the Owner in terracotta, stock roles in sage, café roles neutral. */
export const roleTone = (role: string) =>
    role === 'Owner'
        ? 'bg-accent-200 text-accent-900'
        : role === 'Warehouse' || role === 'Commissary'
          ? 'bg-accent-2-200 text-accent-2-900'
          : 'bg-neutral-200 text-neutral-800';

export const openScreen = (screen: Screen, query: Record<string, string> = {}) =>
    router.get(route('owner'), { screen, ...query }, { preserveScroll: true, replace: true });

/** A date as Y-m-d in the browser's time zone. */
export const isoDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** "Today, 7:12 AM", "Yesterday, 4:40 PM" or "Aug 18, 11:30 AM". */
export function stamp(iso: string): string {
    const at = new Date(iso);
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (isoDate(at) === isoDate(new Date())) {
        return `Today, ${time}`;
    }

    if (isoDate(at) === isoDate(yesterday)) {
        return `Yesterday, ${time}`;
    }

    return `${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}
