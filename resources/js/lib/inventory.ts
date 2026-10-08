/**
 * Types and helpers for Inventory (App\Http\Controllers\InventoryController). The server sends only the
 * open screen's data.
 */
import { type Source, type TransferRow } from '@/lib/transfers';
import { router } from '@inertiajs/react';

export type Screen = 'dash' | 'wh' | 'cm' | 'shop' | 'sup' | 'hist';

export interface Location {
    id: number;
    name: string;
    /** Whether the signed-in user may change this location's stock. */
    can: boolean;
}

export interface HeldItem {
    id: number;
    stock_item_id: number;
    name: string;
    sku: string;
    category: string;
    unit: string;
    cost: number;
    on_hand: number;
    par: number;
    critical: number | null;
    critical_level: number;
    supplier_id: number | null;
    supplier: string | null;
    pack_name: string | null;
    pack_size: number | null;
}

export interface LowItem extends HeldItem {
    location: string;
    in_list: boolean;
}

export interface ProductRow {
    id: number;
    stock_item_id: number;
    name: string;
    sku: string;
    category: string;
    unit: string;
    servings_per_batch: number | null;
    serving_size: string | null;
    serving_unit: string | null;
    stock_per_batch: number | null;
    ingredients: { stock_item_id: number; qty: number }[];
}

export type BatchStatus = 'to_produce' | 'in_production' | 'ready' | 'delivered';

export interface BatchRow {
    id: number;
    product_id: number;
    name: string;
    batches: number;
    status: BatchStatus;
    status_label: string;
    logged_at: string;
    transfer_no: string | null;
}

export interface IngredientChoice {
    id: number;
    name: string;
    sku: string;
    category: string;
    unit: string;
    /** On hand at the warehouse; null when the warehouse doesn't stock it. */
    at_warehouse: number | null;
}

export interface ShopLine {
    id: number;
    /** The kind of location it was added from; null for a manual line. */
    location: 'warehouse' | 'commissary' | null;
    name: string;
    unit: string;
    cost: number;
    qty: number;
    ticked: boolean;
    reason: string | null;
}

export interface SupplierRow {
    id: number;
    name: string;
    contact: string | null;
    phone: string | null;
    supplies: string | null;
}

export interface DeliveredLine {
    transfer_id: number;
    from_id: number;
    name: string;
    unit: string;
    qty: number;
}

export interface InventoryBase {
    screen: Screen;
    today: string;
    locations: { wh: Location | null; cm: Location | null };
    lowCount: number;
    openBatches: number;
    isOwner: boolean;
}

export interface LocationData {
    items: HeldItem[];
    suppliers: { id: number; name: string }[];
    units: string[];
    transfers: TransferRow[];
    sources: Source[];
}

export type InventoryProps = InventoryBase &
    (
        | { screen: 'dash'; month: string; low: LowItem[]; onHand: { name: string; items: number; value: number }[]; delivered: DeliveredLine[] }
        | ({ screen: 'wh' } & Partial<LocationData>)
        | ({ screen: 'cm'; products?: ProductRow[]; batches?: BatchRow[]; ingredientChoices?: IngredientChoice[] } & Partial<LocationData>)
        | { screen: 'shop'; lines: ShopLine[]; deliverTo: string[]; suppliers: string[] }
        | { screen: 'sup'; suppliers: SupplierRow[] }
        | { screen: 'hist'; transfers: TransferRow[] }
    );

export type ScreenData<S extends Screen> = Extract<InventoryProps, { screen: S }>;

/** Open a screen, reloading its data. */
export function openScreen(screen: Screen, params: Record<string, string> = {}): void {
    router.get(route('inventory'), { screen, ...params }, { preserveScroll: false });
}

/** Out of stock, Critical, Below par or Healthy, with its tag classes. */
export function stockTag(item: Pick<HeldItem, 'on_hand' | 'par' | 'critical_level'>): { label: string; className: string } {
    if (item.on_hand <= 0) {
        return { label: 'Out of stock', className: 'bg-accent-900 text-neutral-100' };
    }

    if (item.on_hand < item.critical_level) {
        return { label: 'Critical', className: 'bg-accent-800 text-neutral-100' };
    }

    if (item.on_hand < item.par) {
        return { label: 'Below par', className: 'bg-accent-200 text-accent-900' };
    }

    return { label: 'Healthy', className: 'bg-accent-2-200 text-accent-2-800' };
}

/** A copy of a record without one key, such as a typed draft once it is saved. */
export function omit<T>(record: Record<number, T>, key: number): Record<number, T> {
    const next = { ...record };
    delete next[key];

    return next;
}

/** "8.5", rounded to two places without trailing zeros. */
export const trim = (n: number) => String(Math.round(n * 100) / 100);
