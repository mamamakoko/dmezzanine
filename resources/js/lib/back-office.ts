/**
 * Types and helpers for the till's back office (the Inventory screen). The server sends only the open
 * tab's data; see App\Services\BackOffice.
 */
import { type PaymentKind } from '@/lib/till';
import { router } from '@inertiajs/react';

export type BackOfficeTab = 'dash' | 'menu' | 'addons' | 'payments' | 'stock' | 'sales';

export interface StockRow {
    id: number;
    sku: string;
    name: string;
    category: string;
    unit: string;
    par: number;
    cost: number;
    on_hand: number;
    counted_on: string | null;
    low: boolean;
}

export interface StockChoice {
    id: number;
    name: string;
    unit: string;
    cost: number;
}

export interface Part {
    stock_item_id: number;
    qty: number;
}

export interface UnpaidOrder {
    id: number;
    no: number;
    ticket: number | null;
    tab_name: string | null;
    total: number;
    created_at: string;
}

export interface MenuCategory {
    id: number;
    name: string;
    count: number;
}

export interface MenuRow {
    entry_id: number;
    id: number;
    name: string;
    note: string | null;
    price: number;
    category_id: number;
    available: boolean;
    has_modifiers: boolean;
    photo_url: string | null;
    recipe: Part[];
    addon_ids: number[];
}

export interface AddonRow {
    id: number;
    name: string;
    price: number;
    on: boolean;
    parts: Part[];
    menu_item_ids: number[];
}

export interface PaymentMethodRow {
    id: number;
    name: string;
    kind: PaymentKind;
    split: boolean;
    note: string | null;
    terminal: string | null;
    wallets: string | null;
    tab_limit: number | null;
    lead_only: boolean;
    active: boolean;
}

export interface ReceiptLine {
    id: number;
    qty: number;
    name: string;
    mods: string;
    line_total: number;
    refunded: number;
}

export interface Receipt {
    id: number;
    no: number;
    created_at: string;
    service: string;
    ticket: number | null;
    method: string;
    payments: { method: string; amount: number }[];
    unpaid: boolean;
    tab_name: string | null;
    senior: boolean;
    gross: number;
    discount: number;
    vat_exempt: number;
    vat: number;
    total: number;
    cashier: string | null;
    refund_of_no: number | null;
    refund_reason: string | null;
    lines: ReceiptLine[];
}

interface BackOfficeBase {
    isOwner: boolean;
    lowCount: number;
}

export type BackOfficeData = BackOfficeBase &
    (
        | { tab: 'dash'; stock: StockRow[]; salesToday: { total: number; count: number }; unpaid: UnpaidOrder[] }
        | {
              tab: 'menu';
              categories: MenuCategory[];
              items: MenuRow[];
              otherItems: { id: number; name: string }[];
              stockItems: StockChoice[];
              addons: { id: number; name: string; price: number }[];
          }
        | { tab: 'addons'; addons: AddonRow[]; stockItems: StockChoice[]; menuGroups: { name: string; items: { id: number; name: string }[] }[] }
        | { tab: 'payments'; methods: PaymentMethodRow[]; log: { id: number; who: string; text: string; when: string }[] }
        | { tab: 'stock'; stock: StockRow[] }
        | {
              tab: 'sales';
              filters: { from: string | null; to: string | null };
              today: string;
              limit: number;
              receipts: Receipt[];
              todayTotals: { total: number; count: number };
              unpaid: UnpaidOrder[];
              refundReasons: string[];
              refundMethods: string[];
          }
    );

/** Open a back-office tab (or close the back office with null), reloading only its data. */
export function openBackOffice(tab: BackOfficeTab | null, filters: Record<string, string> = {}): void {
    router.get(route('pos'), tab ? { inv: tab, ...filters } : {}, { preserveState: true, preserveScroll: tab !== null, only: ['backOffice'] });
}

export type TabData<T extends BackOfficeTab> = Extract<BackOfficeData, { tab: T }>;

export const TAB_META: Record<BackOfficeTab, { label: string; title: string; sub: string }> = {
    dash: { label: 'Dashboard', title: 'Branch dashboard', sub: 'Today at this branch — stock health, sales and what needs attention.' },
    menu: { label: 'Menu', title: 'Menu & pricing', sub: 'Add items, change prices, take something off the board.' },
    addons: {
        label: 'Add-ons',
        title: 'Add-ons',
        sub: 'The Owner sets the add-on list, prices and which items offer them. Each branch can switch an add-on off when it runs out.',
    },
    payments: { label: 'Till settings', title: 'Till settings', sub: "Payment methods this branch's till offers. Each branch sets its own." },
    stock: { label: 'Stock', title: 'Stock on hand', sub: 'On hand from the last approved count, against par.' },
    sales: { label: 'Sales', title: 'Sales', sub: 'Every sale and refund at this branch, newest first.' },
};

export const PAYMENT_KINDS: { value: PaymentKind; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'qr', label: 'QR / e-wallet' },
    { value: 'tab', label: 'Tab (pay later)' },
    { value: 'other', label: 'Other' },
];

/** "DMC-Iriga Branch" → "Iriga". */
export const shortBranch = (name: string) => name.replace(/^DMC\s*-\s*/, '').replace(/ Branch$/, '');

/** "1.2 kg", without trailing zeros. */
export const qtyLabel = (qty: number, unit: string) => `${+qty.toFixed(3)} ${unit}`;

export const stockStatus = (row: StockRow): { label: string; tone: 'accent' | 'outline' | 'ok' } =>
    row.on_hand <= 0
        ? { label: 'out', tone: 'accent' }
        : row.low
          ? { label: 'low', tone: 'accent' }
          : row.on_hand < row.par
            ? { label: 'below par', tone: 'outline' }
            : { label: 'ok', tone: 'ok' };

export const PHOTO_WIDTH = 800;
export const PHOTO_HEIGHT = 450;

/**
 * Crop a photo to the centre 16:9 and scale it to 800×450, as the menu tiles show it. Rejects photos
 * smaller than 800×450, like the server does.
 */
export function cropMenuPhoto(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);

            if (image.naturalWidth < PHOTO_WIDTH || image.naturalHeight < PHOTO_HEIGHT) {
                reject(
                    new Error(
                        `${file.name} is ${image.naturalWidth}×${image.naturalHeight} — it needs to be at least ${PHOTO_WIDTH}×${PHOTO_HEIGHT}`,
                    ),
                );

                return;
            }

            const scale = Math.min(image.naturalWidth / PHOTO_WIDTH, image.naturalHeight / PHOTO_HEIGHT);
            const width = PHOTO_WIDTH * scale;
            const height = PHOTO_HEIGHT * scale;
            const canvas = document.createElement('canvas');
            canvas.width = PHOTO_WIDTH;
            canvas.height = PHOTO_HEIGHT;
            canvas
                .getContext('2d')
                ?.drawImage(
                    image,
                    (image.naturalWidth - width) / 2,
                    (image.naturalHeight - height) / 2,
                    width,
                    height,
                    0,
                    0,
                    PHOTO_WIDTH,
                    PHOTO_HEIGHT,
                );
            canvas.toBlob(
                (blob) =>
                    blob ? resolve(new File([blob], 'menu-photo.jpg', { type: 'image/jpeg' })) : reject(new Error('That photo could not be read')),
                'image/jpeg',
                0.85,
            );
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That file could not be read as an image'));
        };

        image.src = url;
    });
}

/**
 * Open a printable A4 report in the browser's print dialog, where it can be saved as a PDF.
 */
export function printReport(title: string, subtitle: string, bodyHtml: string): void {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
    document.body.appendChild(frame);

    const doc = frame.contentWindow?.document;

    if (!doc) {
        frame.remove();

        return;
    }

    doc.open();
    doc.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
@page{size:A4;margin:14mm}body{font-family:Figtree,system-ui,sans-serif;color:#201e1d;font-size:11px}
h1{font-size:18px;margin:0 0 2px}p.sub{margin:0 0 14px;color:#5b5650}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #ddd;vertical-align:top}
th{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#5b5650}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
.row{display:grid;grid-template-columns:200px 1fr 110px;gap:10px;align-items:center;margin:4px 0}
.track{height:10px;background:#f1e8da;border-radius:2px;overflow:hidden}.track span{display:block;height:100%}
.muted{color:#5b5650}.totals{display:flex;gap:24px;margin:10px 0 16px}.totals b{display:block;font-size:15px}
</style></head><body><h1>${escapeHtml(title)}</h1><p class="sub">${escapeHtml(subtitle)}</p>${bodyHtml}</body></html>`,
    );
    doc.close();

    setTimeout(() => {
        try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
        } catch {
            // Printing is best-effort; the data stays on screen.
        }

        setTimeout(() => frame.remove(), 1500);
    }, 120);
}

export const escapeHtml = (text: string) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
