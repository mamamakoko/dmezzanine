/**
 * Thermal printing for the till, ported from the POS prototype. A USB receipt printer paired over WebUSB
 * (Chrome or Edge) gets ESC/POS bytes directly: print, feed, cut, and a drawer kick for receipts. With no
 * printer paired, the slip opens in the browser's print dialog sized for 58mm paper.
 */
import { pad2, type TillOrder } from '@/lib/till';

/* Just enough of the WebUSB API for this file; TypeScript's DOM types don't include it. */
interface UsbEndpoint {
    endpointNumber: number;
    direction: 'in' | 'out';
    type: 'bulk' | 'interrupt' | 'isochronous';
}

interface UsbInterface {
    interfaceNumber: number;
    alternates: { endpoints: UsbEndpoint[] }[];
}

interface UsbDevice {
    productName?: string;
    configuration: { interfaces: UsbInterface[] } | null;
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(value: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<unknown>;
}

interface Usb {
    requestDevice(options: { filters: { classCode?: number }[] }): Promise<UsbDevice>;
}

export type SlipKind = 'receipt' | 'ticket' | 'slip';

/** Characters per line on 58mm paper. */
const WIDTH = 32;

let connection: { device: UsbDevice; endpoint: number } | null = null;

export class PrinterError extends Error {}

/**
 * Ask the browser to pair a USB printer and claim its bulk-out endpoint. Resolves to the printer's name,
 * or null when the cashier closes the picker without choosing one.
 */
export async function connectPrinter(): Promise<string | null> {
    const usb = (navigator as Navigator & { usb?: Usb }).usb;

    if (!usb) {
        throw new PrinterError('This browser has no WebUSB — use Chrome or Edge');
    }

    let device: UsbDevice;

    try {
        device = await usb.requestDevice({ filters: [{ classCode: 7 }, {}] });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            return null;
        }

        if (error instanceof DOMException && error.name === 'SecurityError') {
            throw new PrinterError('USB is blocked here — open the POS in its own browser tab');
        }

        throw error;
    }

    try {
        await device.open();

        if (!device.configuration) {
            await device.selectConfiguration(1);
        }

        let claimed: { interfaceNumber: number; endpoint: number } | null = null;

        for (const usbInterface of device.configuration?.interfaces ?? []) {
            for (const alternate of usbInterface.alternates) {
                const out = alternate.endpoints.find((endpoint) => endpoint.direction === 'out' && endpoint.type === 'bulk');

                if (out && !claimed) {
                    claimed = { interfaceNumber: usbInterface.interfaceNumber, endpoint: out.endpointNumber };
                }
            }
        }

        if (!claimed) {
            throw new PrinterError('That device has no way to receive print jobs');
        }

        await device.claimInterface(claimed.interfaceNumber);
        connection = { device, endpoint: claimed.endpoint };

        return device.productName || 'USB printer';
    } catch (error) {
        if (error instanceof PrinterError) {
            throw error;
        }

        throw new PrinterError('Could not claim the printer — the OS driver may have it');
    }
}

/** Release the paired printer. */
export function disconnectPrinter(): void {
    const current = connection;
    connection = null;
    current?.device.close().catch(() => {});
}

export const isPrinterConnected = () => connection !== null;

/** Print a slip on the paired printer, or through the browser's print dialog if none is paired. */
export async function printSlip(kind: SlipKind, text: string): Promise<void> {
    if (connection) {
        try {
            await connection.device.transferOut(connection.endpoint, escpos(text, kind));
        } catch {
            throw new PrinterError('Send failed — reconnect the printer');
        }

        return;
    }

    printInBrowser(text);
}

/** The customer receipt, with prices. */
export function receiptText(order: TillOrder, branchName: string): string {
    const lines = [
        center("D' MEZZANINE CAFE"),
        center(branchName),
        center(order.service),
        '',
        row('Receipt', `#${order.no}`),
        row('Ticket', pad2(order.ticket)),
        stamp(order),
        rule(),
    ];

    for (const line of order.lines) {
        lines.push(row(`${line.qty}x ${line.name}`, money(line.line_total ?? 0)));
        pushMods(lines, line.mods);
    }

    lines.push(rule());

    if (order.vat_exempt) {
        lines.push(row('VAT exempt', '-' + money(order.vat_exempt)));
    }

    if (order.discount) {
        lines.push(row('Senior/PWD 20%', '-' + money(order.discount)));
    }

    lines.push(row('TOTAL', money(order.total ?? 0)));

    if (!order.senior && order.vat) {
        lines.push(row('VAT 12% incl.', money(order.vat)));
    }

    for (const payment of order.payments ?? []) {
        lines.push(row(payment.method, money(payment.amount)));

        if (payment.tendered !== null) {
            lines.push(row('  Tendered', money(payment.tendered)));
        }

        if (payment.change) {
            lines.push(row('  Change', money(payment.change)));
        }
    }

    if (order.unpaid) {
        lines.push('', center('*** UNPAID ***'));

        if (order.tab_name) {
            lines.push(center(`Tab: ${order.tab_name}`));
        }
    }

    if (order.note) {
        lines.push(rule(), `Note: ${order.note}`);
    }

    lines.push('', center('Salamat po!'), center('This serves as your receipt'));

    return lines.join('\n');
}

/** The kitchen ticket: items and choices only. */
export function ticketText(order: TillOrder): string {
    const lines = [center('*** KITCHEN TICKET ***'), '', center(`TICKET ${pad2(order.ticket)}`), '', rule()];

    for (const line of order.lines) {
        lines.push(`${line.qty}x ${line.name}`);
        pushMods(lines, line.mods);
    }

    lines.push(rule(), `${order.service} · #${order.no}`, stamp(order));

    if (order.note) {
        lines.push(`Note: ${order.note}`);
    }

    return lines.join('\n');
}

/** The Branch Menu slip: the order for the cashier, with no prices. */
export function slipText(order: TillOrder, branchName: string): string {
    const lines = [
        center("D' MEZZANINE CAFE"),
        center(branchName),
        '',
        row('Order', `#${order.no}`),
        row('Ticket', pad2(order.ticket)),
        order.service,
        stamp(order),
        rule(),
    ];

    for (const line of order.lines) {
        lines.push(`${line.qty}x ${line.name}`);
        pushMods(lines, line.mods);
    }

    lines.push(rule());

    if (order.note) {
        lines.push(`Note: ${order.note}`);
    }

    lines.push('', center('Pay at the till'));

    return lines.join('\n');
}

function escpos(text: string, kind: SlipKind): Uint8Array {
    const bytes = [
        0x1b,
        0x40, // initialise
        0x1b,
        0x74,
        0x00, // code page 437
        ...new TextEncoder().encode(toPrinterCharset(text) + '\n'),
        0x1b,
        0x64,
        0x04, // feed 4 lines
        0x1d,
        0x56,
        0x42,
        0x00, // partial cut
    ];

    if (kind === 'receipt') {
        bytes.push(0x1b, 0x70, 0x00, 0x19, 0xfa); // open the cash drawer
    }

    return new Uint8Array(bytes);
}

/** Code page 437 has no peso sign or middle dot. */
const toPrinterCharset = (text: string) => text.replace(/₱/g, 'P').replace(/·/g, '-');

function printInBrowser(text: string): void {
    const body = text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
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
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>receipt</title><style>@page{size:58mm auto;margin:0}html,body{margin:0;padding:0}pre{margin:0;box-sizing:border-box;padding:2mm 2mm 8mm;width:52mm;font-family:"Courier New",monospace;font-size:7pt;line-height:1.32;white-space:pre-wrap;word-break:break-word;color:#000}</style></head><body><pre>' +
            body +
            '</pre></body></html>',
    );
    doc.close();

    const print = () => {
        try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
        } catch {
            // The print dialog is best-effort; the receipt stays on screen.
        }

        setTimeout(() => frame.remove(), 1500);
    };

    if (doc.readyState === 'complete') {
        setTimeout(print, 60);
    } else {
        frame.onload = () => setTimeout(print, 60);
    }
}

const rule = () => '-'.repeat(WIDTH);

const center = (text: string) => ' '.repeat(Math.max(0, Math.floor((WIDTH - text.length) / 2))) + text;

/** Label on the left, amount on the right; wraps the amount to its own line when both don't fit. */
const row = (left: string, right: string) =>
    left.length + right.length < WIDTH ? left + ' '.repeat(WIDTH - left.length - right.length) + right : left + '\n' + right.padStart(WIDTH);

const money = (amount: number) => 'P' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const stamp = (order: TillOrder) =>
    new Date(order.created_at).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function pushMods(lines: string[], mods: string): void {
    if (mods && mods !== 'No changes') {
        lines.push(`   ${mods}`);
    }
}
