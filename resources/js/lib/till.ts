/**
 * Shared types and money maths for the till (POS and Branch Menu). The server prices every order again
 * and is the source of truth; these mirror its rules so the till can show totals as the cashier works.
 */

export interface TillBranch {
    id: number;
    name: string;
}

export interface TillStaff {
    name: string;
    role: string;
}

export interface TillCategory {
    id: number;
    name: string;
}

/** A menu item. Order-only mode (Branch Menu) receives no prices. */
export interface TillMenuItem {
    id: number;
    name: string;
    note: string | null;
    category_id: number;
    has_modifiers: boolean;
    photo_url: string | null;
    addon_ids: number[];
    price?: number;
}

export interface TillAddon {
    id: number;
    name: string;
    price?: number;
}

/** A size or milk choice. */
export interface TillChoice {
    value: string;
    label: string;
    price?: number;
}

export type PaymentKind = 'cash' | 'card' | 'qr' | 'tab' | 'other';

export interface TillPaymentMethod {
    id: number;
    name: string;
    kind: PaymentKind;
    split: boolean;
    note: string | null;
    terminal: string | null;
    wallets: string | null;
    tab_limit: number | null;
    lead_only: boolean;
}

export type OrderStatus = 'preparing' | 'ready' | 'served';

export interface TillOrderLine {
    qty: number;
    name: string;
    mods: string;
    line_total?: number;
}

export interface TillOrderPayment {
    method: string;
    kind: PaymentKind;
    amount: number;
    tendered: number | null;
    change: number;
}

/** An order on the queue board or a receipt. Order-only mode receives no amounts. */
export interface TillOrder {
    id: number;
    no: number;
    ticket: number;
    service: string;
    status: OrderStatus;
    source: 'till' | 'branch_menu' | 'marketing';
    unpaid: boolean;
    tab_name: string | null;
    note: string | null;
    senior: boolean;
    cashier: string | null;
    created_at: string;
    /** The marketing order it came from, when the branch accepted one from its inbox. */
    marketing?: { no: string; customer: string; phone: string | null; address: string | null; wanted: string; service: string } | null;
    lines: TillOrderLine[];
    gross?: number;
    vat_exempt?: number;
    discount?: number;
    vat?: number;
    total?: number;
    payments?: TillOrderPayment[];
}

/** A line on the pending order. Lines with the same item and choices are merged. */
export interface CartLine {
    key: string;
    menuItemId: number;
    name: string;
    /** Price of one unit including size, milk and add-ons; 0 in order-only mode. */
    each: number;
    qty: number;
    size: string | null;
    milk: string | null;
    addonIds: number[];
    mods: string;
}

/** What the till sends for a payment, single or split. */
export interface PaymentInput {
    split: boolean;
    payment_method_id?: number;
    tendered?: string;
    tab_name?: string;
    parts?: { payment_method_id: number; amount: string }[];
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "₱1,250", rounded to the peso, as on the menu tiles and order lines. */
export const peso = (amount: number) => '₱' + Math.round(amount).toLocaleString('en-PH');

/** "₱1,250.00", for totals and amounts due. */
export const peso2 = (amount: number) =>
    '₱' + (Math.round((amount || 0) * 100) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toCentavos = (amount: number) => Math.round(amount * 100);

export interface Totals {
    /** Total sales, VAT included. */
    gross: number;
    /** Amount net of VAT. */
    net: number;
    /** The VAT in the gross. Senior/PWD orders don't pay it. */
    vat: number;
    discount: number;
    total: number;
}

/**
 * Prices include 12% VAT. Senior/PWD: the VAT is removed, then 20% comes off the amount net of VAT.
 * Mirrors App\Services\OrderTotals, in centavos so both round the same way.
 */
export function orderTotals(gross: number, senior: boolean): Totals {
    const grossC = toCentavos(gross);
    const netC = Math.round(grossC / 1.12);
    const vatC = grossC - netC;
    const discountC = senior ? Math.round(netC * 0.2) : 0;
    const totalC = senior ? netC - discountC : grossC;

    return { gross: grossC / 100, net: netC / 100, vat: vatC / 100, discount: discountC / 100, total: totalC / 100 };
}

/**
 * Cash quick amounts: the exact amount, then the next ₱100, ₱500 and ₱1,000 bills above it.
 * When some of those coincide, further thousands fill the row to four buttons.
 */
export function cashQuickAmounts(due: number): number[] {
    const amounts = [due];

    for (const bill of [100, 500, 1000]) {
        const rounded = Math.ceil(due / bill) * bill;

        if (rounded > due && !amounts.includes(rounded)) {
            amounts.push(rounded);
        }
    }

    let next = Math.ceil(due / 1000) * 1000;

    while (amounts.length < 4) {
        next += 1000;

        if (!amounts.includes(next)) {
            amounts.push(next);
        }
    }

    return amounts.slice(0, 4);
}

/** "Large · Oat · Extra shot", or "No changes" — the same wording the server puts on receipts. */
export function modsLabel(size: TillChoice | undefined, milk: TillChoice | undefined, addons: TillAddon[]): string {
    const mods = [
        size && size.value !== 'regular' ? size.label : null,
        milk && milk.value !== 'fresh' ? milk.label : null,
        ...addons.map((a) => a.name),
    ].filter(Boolean);

    return mods.length ? mods.join(' · ') : 'No changes';
}

export const minutesSince = (iso: string, now: Date) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));

export const STATUS_LABELS: Record<OrderStatus, string> = { preparing: 'Preparing', ready: 'Ready', served: 'Served' };

export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = { preparing: 'ready', ready: 'served', served: null };

/** The first validation message from an Inertia error bag, for the till's toast. */
export const firstError = (errors: Record<string, string>) => Object.values(errors)[0] ?? 'Something went wrong. Try again.';
