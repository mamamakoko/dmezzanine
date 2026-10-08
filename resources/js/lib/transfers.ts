/**
 * Transfers between locations, as the till's Stock-in tab and Inventory show them (App\Http\Resources\
 * TransferResource). The server decides what can happen next; these only format, filter and tag.
 */

export type TransferStatus = 'requested' | 'approved' | 'in_transit' | 'partially_received' | 'received' | 'rejected' | 'cancelled';

export interface TransferLineRow {
    id: number;
    stock_item_id: number;
    name: string;
    sku: string;
    qty: number;
    unit: string;
    received: boolean;
    issue: { reason: string; label: string; note: string | null } | null;
}

export interface TransferRow {
    id: number;
    no: string;
    kind: string;
    from: { id: number; name: string };
    to: { id: number; name: string };
    status: TransferStatus;
    status_label: string;
    raised_at: string;
    /** The business day it was raised, Y-m-d. */
    day: string;
    by: string | null;
    lines: TransferLineRow[];
}

/** An item a location holds, offered on a requisition. */
export interface SourceItem {
    id: number;
    sku: string;
    name: string;
    category: string;
    unit: string;
    on_hand: number;
}

export interface Source {
    id: number;
    name: string;
    items: SourceItem[];
}

export interface IssueReason {
    value: string;
    label: string;
}

export const ISSUE_REASONS: IssueReason[] = [
    { value: 'short_delivery', label: 'Short delivery' },
    { value: 'damaged', label: 'Damaged on arrival' },
    { value: 'wrong_item', label: 'Wrong item' },
    { value: 'quality', label: 'Quality below spec' },
    { value: 'price_mismatch', label: 'Price mismatch' },
];

/** Background and text classes for a status tag, from the Inventory prototype. */
export const STATUS_TONE: Record<TransferStatus, string> = {
    requested: 'bg-accent-100 text-accent-700',
    approved: 'bg-accent-300 text-accent-900',
    in_transit: 'bg-neutral-300 text-neutral-900',
    partially_received: 'bg-accent-2-100 text-accent-2-700',
    received: 'bg-accent-2-300 text-accent-2-900',
    rejected: 'bg-neutral-800 text-neutral-100',
    cancelled: 'bg-neutral-200 text-neutral-800',
};

export const isClosed = (transfer: TransferRow) => ['received', 'rejected', 'cancelled'].includes(transfer.status);

export const isReceivable = (transfer: TransferRow) => transfer.status === 'in_transit' || transfer.status === 'partially_received';

export const isCancellable = (transfer: TransferRow) => transfer.status === 'requested' || transfer.status === 'approved';

/** Transfers on their way in: approved, or sent and not all received. */
export const isIncoming = (transfer: TransferRow) => transfer.status === 'approved' || isReceivable(transfer);

/** Within a from–to date range; an empty end is open. */
export const inRange = (transfer: TransferRow, from: string, to: string) => (!from || transfer.day >= from) && (!to || transfer.day <= to);

export const matchesSearch = (transfer: TransferRow, query: string) => {
    const terms = query.trim().toLowerCase();

    return (
        !terms ||
        `${transfer.no} ${transfer.kind} ${transfer.from.name} ${transfer.to.name} ${transfer.lines.map((line) => line.name).join(' ')}`
            .toLowerCase()
            .includes(terms)
    );
};

/** "Aug 12, 7:40 AM". */
export const raisedLabel = (iso: string) =>
    new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** What a line is waiting for, or that it arrived. */
export function lineState(transfer: TransferRow, line: TransferLineRow): string {
    if (line.received) {
        return 'Received';
    }

    return (
        {
            requested: 'Awaiting approval',
            approved: 'Awaiting issue',
            in_transit: 'In transit',
            partially_received: 'In transit',
            received: 'Received',
            rejected: '—',
            cancelled: '—',
        } as Record<TransferStatus, string>
    )[transfer.status];
}

/** "2 of 3 received", or the line count once closed. */
export function progressLabel(transfer: TransferRow): string {
    const count = transfer.lines.length;

    return isClosed(transfer)
        ? `${count} ${count === 1 ? 'line' : 'lines'}`
        : `${transfer.lines.filter((line) => line.received).length} of ${count} received`;
}

/** "6 kg", without trailing zeros. */
export const qty = (amount: number, unit: string) => `${+amount.toFixed(3)} ${unit}`;
