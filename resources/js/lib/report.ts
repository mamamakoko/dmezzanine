/**
 * Printable reports (Export PDF) for the back office and the stock report.
 */

/**
 * Open a printable A4 report in the browser's print dialog, where it can be saved as a PDF. There is no
 * PDF library in the app; the browser's "Save as PDF" does the work.
 */
export function printReport(title: string, subtitle: string, bodyHtml: string, orientation: 'portrait' | 'landscape' = 'portrait'): void {
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
@page{size:A4 ${orientation};margin:14mm}body{font-family:Figtree,system-ui,sans-serif;color:#201e1d;font-size:11px}
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
