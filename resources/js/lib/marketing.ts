/**
 * Types for marketing orders (the Marketing page and the till's inbox) and the client map. Nothing here
 * carries a price: marketing never sees money, and the till prices an order when the branch accepts it.
 */

export interface MarketingOrderLine {
    menu_item_id: number | null;
    name: string;
    qty: number;
    addons: { id: number; name: string }[];
}

export interface MarketingOrderView {
    id: number;
    no: string;
    branch_id: number;
    branch: string;
    agent: string | null;
    service: 'pickup' | 'delivery';
    service_label: string;
    customer: string;
    phone: string | null;
    address: string | null;
    wanted_on: string;
    wanted_at: string | null;
    wanted: string;
    note: string | null;
    status: 'sent' | 'accepted' | 'declined';
    /** Sent, Declined, or once accepted the till order's Preparing / Ready / Served. */
    progress: string;
    reply: string | null;
    replied_by: string | null;
    ticket: number | null;
    paid: boolean;
    sent_at: string;
    lines: MarketingOrderLine[];
}

/** One branch's menu as marketing sees it: available items only, no prices. */
export interface MarketingBranch {
    id: number;
    name: string;
    total_items: number;
    categories: { id: number; name: string }[];
    items: { id: number; name: string; note: string | null; category_id: number; photo_url: string | null; addon_ids: number[] }[];
    addons: { id: number; name: string }[];
}

export interface ClientTypeView {
    id: number;
    name: string;
    color: string;
    count: number;
}

export interface ClientAreaView {
    id: number;
    name: string;
    officer_id: number | null;
    officer: string | null;
    lat: number;
    lng: number;
    radius_m: number;
}

export interface MapBranch {
    id: number;
    name: string;
    address: string | null;
    status: string;
    manager: string | null;
    staff: number;
    lat: number | null;
    lng: number | null;
}

export interface ClientView {
    id: number;
    name: string;
    client_type_id: number;
    contact: string | null;
    address: string | null;
    lat: number;
    lng: number;
    branch_id: number | null;
    officer_id: number | null;
    /** Who handles the client: assigned directly (via null) or from the named area. */
    officer: { id: number; name: string; via: string | null } | null;
    last_order_on: string | null;
    notes: string | null;
    added_by: string | null;
}

/** The eight curated legend colors from the prototype. */
export const SWATCHES = [
    'oklch(0.55 0.11 135)',
    'oklch(0.5 0.1 250)',
    'oklch(0.68 0.14 80)',
    'oklch(0.52 0.12 350)',
    'oklch(0.58 0.12 40)',
    'oklch(0.55 0.09 190)',
    'oklch(0.48 0.1 300)',
    'oklch(0.45 0.03 60)',
];

const OFFICER_COLORS = ['oklch(0.5 0.1 250)', 'oklch(0.55 0.12 30)', 'oklch(0.52 0.1 160)', 'oklch(0.5 0.12 310)', 'oklch(0.6 0.12 85)'];

/** A steady color per officer for their areas; areas without an officer are a dashed neutral. */
export const officerColor = (officerId: number | null, officerIds: number[]) =>
    officerId === null ? 'oklch(0.45 0.03 60)' : OFFICER_COLORS[Math.max(0, officerIds.indexOf(officerId)) % OFFICER_COLORS.length];

/** "Oct 8, 2026" from "2026-10-08". */
export const niceDate = (day: string | null) =>
    day ? new Date(`${day}T00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

/** Great-circle distance in metres, matching the server's ClientMap::distance. */
export function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;

    return 6371008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
