/**
 * Types and helpers for the Sales page (App\Http\Controllers\SalesController). The server adds up the
 * sales (App\Services\SalesReport); these only format and draw them.
 */
import { escapeHtml, printReport } from '@/lib/report';
import { type StockBranch } from '@/lib/stock';
import { peso, peso2 } from '@/lib/till';

export type Period = 'today' | 'week' | 'month';

export interface DayTotals {
    date: string;
    tx: number;
    gross: number;
    total: number;
    net: number;
    vat: number;
    vat_exempt: number;
    discount: number;
}

export interface SalesProps {
    filters: { period: Period; from: string | null; to: string | null; branch: number | null };
    range: { from: string; to: string };
    today: string;
    /** The branch reported on; null for all branches (the Owner). */
    branch: StockBranch | null;
    /** The café branches the Owner can pick from; null for everyone else. */
    branches: StockBranch[] | null;
    report: {
        totals: Omit<DayTotals, 'date'>;
        days: DayTotals[];
        branches: { id: number; name: string; tx: number; total: number }[];
        categories: { name: string; amount: number }[];
        methods: { name: string; amount: number }[];
        items: { name: string; category: string; qty: number; amount: number }[];
    };
}

export const PERIOD_LABELS: Record<Period, string> = { today: 'Today', week: 'This week', month: 'This month' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** A business date (Y-m-d) as a local date, so its weekday doesn't shift with the time zone. */
const asDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(year, month - 1, day);
};

/** "Mon · Oct 6" */
export const dayLabel = (date: string) => {
    const d = asDate(date);

    return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

/** "Mon 6 Oct" */
export const dayShort = (date: string) => {
    const d = asDate(date);

    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** A bar's label: the weekday over a week, the date over anything longer. */
export const barLabel = (date: string, dayCount: number) => {
    const d = asDate(date);

    return dayCount <= 7 ? WEEKDAYS[d.getDay()] : String(d.getDate());
};

/** "6 Oct" */
const shortDate = (date: string) => {
    const d = asDate(date);

    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "Today", "This week", or "6 Oct – 12 Oct" for a custom range. */
export function rangeText(props: Pick<SalesProps, 'filters' | 'range'>): string {
    const { filters, range } = props;

    if (!filters.from && !filters.to) {
        return PERIOD_LABELS[filters.period];
    }

    return range.from === range.to ? shortDate(range.from) : `${shortDate(range.from)} – ${shortDate(range.to)}`;
}

/** "₱12.4k" for the chart's axis and bar labels. */
export const compactPeso = (amount: number) =>
    Math.abs(amount) >= 10000 ? `₱${Math.round(amount / 1000)}k` : Math.abs(amount) >= 1000 ? `₱${(amount / 1000).toFixed(1)}k` : peso(amount);

/** Negative amounts (refunds) as "−₱95". */
export const signedPeso = (amount: number) => (amount < 0 ? `−${peso(-amount)}` : peso(amount));

/**
 * The sales report as a printable A4 page: summary, the day chart and table, items, categories,
 * payment methods and top items.
 */
export function exportSalesPdf(props: SalesProps): void {
    const { report } = props;
    const { totals } = report;
    const days = report.days.filter((day) => day.tx > 0 || day.gross !== 0);
    const branchName = props.branch?.name ?? 'All branches';
    const row = (cells: (string | number)[]) =>
        `<tr>${cells.map((cell, index) => `<td${index ? ' class="n"' : ''}>${escapeHtml(String(cell))}</td>`).join('')}</tr>`;

    const chart = (() => {
        if (!days.length) {
            return '';
        }

        const width = 700;
        const height = 190;
        const bottom = 26;
        const top = 18;
        const max = Math.max(...days.map((day) => day.gross), 1);
        const slot = width / days.length;
        const barWidth = Math.min(46, slot * 0.62);

        const bars = days
            .map((day, index) => {
                const barHeight = Math.max(2, Math.round(((height - bottom - top) * Math.max(day.gross, 0)) / max));
                const x = Math.round(index * slot + (slot - barWidth) / 2);
                const y = height - bottom - barHeight;
                const label =
                    days.length > 14
                        ? ''
                        : `<text x="${Math.round(x + barWidth / 2)}" y="${y - 5}" font-size="9.5" fill="#6b625a" text-anchor="middle">${escapeHtml(compactPeso(day.gross))}</text>`;

                return `<rect x="${x}" y="${y}" width="${Math.round(barWidth)}" height="${barHeight}" rx="3" fill="#b4552d"></rect>${label}<text x="${Math.round(x + barWidth / 2)}" y="${height - bottom + 13}" font-size="9.5" fill="#6b625a" text-anchor="middle">${escapeHtml(barLabel(day.date, days.length))}</text>`;
            })
            .join('');

        return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" style="margin-top:10px"><line x1="0" y1="${height - bottom}" x2="${width}" y2="${height - bottom}" stroke="#e6ddcc"></line>${bars}</svg>`;
    })();

    const bars = (rows: { name: string; amount: number }[], fill: string) => {
        const max = Math.max(...rows.map((entry) => Math.abs(entry.amount)), 1);

        return rows
            .map(
                (entry) =>
                    `<div class="row"><span>${escapeHtml(entry.name)}</span><div class="track"><span style="width:${Math.round((Math.abs(entry.amount) / max) * 100)}%;background:${fill}"></span></div><span class="muted" style="text-align:right">${escapeHtml(signedPeso(entry.amount))}</span></div>`,
            )
            .join('');
    };

    const top = report.items.slice(0, 10);

    printReport(
        'Sales report',
        `${rangeText(props)} · ${branchName} · ${totals.tx} transactions`,
        `<h2 style="font-size:13px;margin:18px 0 0">Summary</h2><table>${[
            row(['Total sales', peso2(totals.gross)]),
            row(['Amount net of VAT', peso2(totals.net)]),
            row(['VAT 12%', peso2(totals.vat)]),
            row(['VAT exempt (senior/PWD)', peso2(totals.vat_exempt)]),
            row(['Senior / PWD discounts', peso2(totals.discount)]),
            row(['Total amount due', peso2(totals.total)]),
            row(['Average ticket', peso2(totals.tx ? totals.total / totals.tx : 0)]),
        ].join('')}</table>
<h2 style="font-size:13px;margin:22px 0 0">Per day</h2>${chart}
<table><tr><th>Day</th><th class="n">Tx</th><th class="n">Total sales</th><th class="n">Net of VAT</th><th class="n">VAT</th><th class="n">Disc.</th></tr>${days
            .map((day) => row([dayShort(day.date), day.tx, peso2(day.gross), peso2(day.net), peso2(day.vat), peso2(day.discount)]))
            .join('')}</table>
<h2 style="font-size:13px;margin:22px 0 6px">Sales by item</h2>${bars(top.slice(0, 8), '#b4552d')}
<h2 style="font-size:13px;margin:22px 0 6px">Sales by category</h2>${bars(report.categories, '#b4552d')}
<h2 style="font-size:13px;margin:22px 0 6px">Payment method</h2>${bars(report.methods, '#5c6b4a')}
<h2 style="font-size:13px;margin:22px 0 0">Top items</h2><table><tr><th>Item</th><th class="n">Qty</th><th class="n">Sales</th></tr>${top
            .map((item) => row([`${item.name} · ${item.category}`, item.qty, peso2(item.amount)]))
            .join('')}</table>`,
    );
}
