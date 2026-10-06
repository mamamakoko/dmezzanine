/**
 * Types and helpers for Stock Count and Stock Report. The server works out beginnings, usage and gaps
 * (App\Services\StockLedger); these only format and sort.
 */

export type SheetStatus = 'draft' | 'submitted' | 'approved' | 'returned';

export interface StockBranch {
    id: number;
    name: string;
}

export interface SheetSummary {
    id: number;
    day: string;
    status: SheetStatus;
    status_label: string;
    by: string | null;
    at: string | null;
    counted?: number;
    flagged?: number;
    reviewed_by?: string | null;
    reviewed_role?: string | null;
    reviewed_at?: string | null;
    received_items?: number;
}

export interface ReviewRow {
    line_id: number;
    stock_item_id: number;
    sku: string;
    name: string;
    unit: string;
    cost: number;
    beginning: number | null;
    received: number;
    counted: number | null;
    adjusted: number | null;
    ending: number | null;
    used: number | null;
    expected: number | null;
    gap: number | null;
    value: number | null;
    off: boolean;
    mark: 'ok' | 'flag' | null;
    note: string | null;
    days?: number;
}

export interface SalesRow {
    name: string;
    category: string | null;
    qty: number;
    amount: number;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "8.5", rounded to two places without trailing zeros. */
export const trim = (n: number) => String(Math.round(n * 100) / 100);

/** "+1.5" or "-0.25". */
export const signed = (n: number) => (n > 0 ? '+' : '') + trim(n);

/** "October 7, 2026" from "2026-10-07". */
export const longDay = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);

    return `${MONTHS[month - 1]} ${date}, ${year}`;
};

/** "Oct 7" from "2026-10-07". */
export const shortDay = (day: string) => {
    const [, month, date] = day.split('-').map(Number);

    return `${MONTHS[month - 1].slice(0, 3)} ${date}`;
};

/** "October 2026" from "2026-10". */
export const longMonth = (month: string) => {
    const [year, number] = month.split('-').map(Number);

    return `${MONTHS[number - 1]} ${year}`;
};

export const timeOf = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');

export const stamp = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/** A number typed into a count box, or null when it is blank or not a number. */
export const parseCount = (raw: string): number | null => {
    const cleaned = raw.replace(/[^0-9.]/g, '');

    return cleaned === '' || Number.isNaN(parseFloat(cleaned)) ? null : parseFloat(cleaned);
};
