import { DateFilter } from '@/components/transfers/transfer-card';
import { type InventoryBase, type ScreenData } from '@/lib/inventory';
import { escapeHtml, printReport } from '@/lib/report';
import { inRange, isClosed, matchesSearch, qty, raisedLabel, STATUS_TONE, type TransferRow } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)_46px_minmax(0,112px)_58px] gap-2.5';

/**
 * Every transfer, newest first, filtered by where it left from and when, with a PDF ledger and a printable
 * slip per transfer.
 */
export function History({ data, locations, query }: { data: ScreenData<'hist'>; locations: InventoryBase['locations']; query: string }) {
    const [from, setFrom] = useState<number | 'all'>('all');
    const [range, setRange] = useState({ from: '', to: '' });

    const sources = [locations.wh, locations.cm].filter((location) => location !== null);
    const dated = data.transfers.filter((transfer) => inRange(transfer, range.from, range.to));
    const rows = dated.filter((transfer) => (from === 'all' || transfer.from.id === from) && matchesSearch(transfer, query));
    const received = rows.filter((transfer) => transfer.status === 'received').length;
    const open = rows.filter((transfer) => !isClosed(transfer)).length;
    const summary = `${rows.length} ${rows.length === 1 ? 'transfer' : 'transfers'} · ${received} received, ${open} in flight, ${rows.length - received - open} cancelled or rejected`;
    const span = range.from || range.to ? `${range.from || 'start'} to ${range.to || 'today'}` : 'All dates';
    const scope = from === 'all' ? 'All locations' : `Out of ${sources.find((source) => source.id === from)?.name}`;

    const exportLedger = () =>
        printReport(
            'Transfer history',
            `D’ Mezzanine Cafe · ${scope} · ${span} · ${rows.length} ${rows.length === 1 ? 'transfer' : 'transfers'}`,
            `<table><thead><tr><th>Ref</th><th>Date</th><th>Kind</th><th>Route</th><th class="n">Lines</th><th>Status</th></tr></thead><tbody>${rows
                .map(
                    (transfer) =>
                        `<tr><td>${transfer.no}</td><td>${transfer.day}</td><td>${escapeHtml(transfer.kind)}</td><td>${escapeHtml(`${transfer.from.name} → ${transfer.to.name}`)}</td><td class="n">${transfer.lines.length}</td><td>${escapeHtml(transfer.status_label)}</td></tr>` +
                        `<tr><td></td><td colspan="5" class="muted">${escapeHtml(transfer.lines.map((line) => `${line.name} ${qty(line.qty, line.unit)}`).join(' · '))}</td></tr>`,
                )
                .join('')}</tbody></table>`,
            'landscape',
        );

    const printSlip = (transfer: TransferRow) =>
        printReport(
            `Transfer slip ${transfer.no}`,
            `${transfer.kind} · ${transfer.from.name} → ${transfer.to.name} · raised ${raisedLabel(transfer.raised_at)}${transfer.by ? ` by ${transfer.by}` : ''} · ${transfer.status_label}`,
            `<table><thead><tr><th>Item</th><th class="n">Quantity</th></tr></thead><tbody>${transfer.lines
                .map((line) => `<tr><td>${escapeHtml(line.name)}</td><td class="n">${escapeHtml(qty(line.qty, line.unit))}</td></tr>`)
                .join('')}</tbody></table>` +
                '<div style="margin-top:52px;display:flex;gap:40px;font-size:11px"><div style="flex:1;border-top:1px solid #201e1d;padding-top:6px">Issued by</div><div style="flex:1;border-top:1px solid #201e1d;padding-top:6px">Received by</div></div>',
        );

    const chip = (on: boolean) =>
        cn(
            'rounded-btn flex min-h-9 cursor-pointer items-center gap-[7px] px-[15px] py-[7px] text-[13px] font-semibold whitespace-nowrap',
            on ? 'bg-accent text-neutral-100' : 'text-text bg-transparent',
        );

    return (
        <div className="flex flex-col gap-3">
            <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-2">
                <div className="border-divider bg-surface rounded-btn flex flex-wrap gap-1 border p-1">
                    <button type="button" onClick={() => setFrom('all')} className={chip(from === 'all')}>
                        All <span className="text-[11px] opacity-65">{dated.length}</span>
                    </button>
                    {sources.map((source) => (
                        <button key={source.id} type="button" onClick={() => setFrom(source.id)} className={chip(from === source.id)}>
                            From {source.name.split(' ·')[0]}{' '}
                            <span className="text-[11px] opacity-65">{dated.filter((transfer) => transfer.from.id === source.id).length}</span>
                        </button>
                    ))}
                </div>
                <div className="min-w-3 flex-1" />
                <DateFilter
                    from={range.from}
                    to={range.to}
                    today=""
                    withToday={false}
                    onChange={(start, end) => setRange({ from: start, to: end })}
                />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md bg-neutral-900 px-[18px] py-3.5 text-neutral-100">
                <div className="min-w-0 flex-[1_1_240px]">
                    <div className="text-[11.5px] tracking-[.08em] uppercase opacity-85">Transfer ledger</div>
                    <div className="mt-[3px] text-[13px] opacity-80">{summary}</div>
                </div>
                <button
                    type="button"
                    disabled={!rows.length}
                    onClick={exportLedger}
                    className="bg-accent rounded-btn min-h-11 flex-none cursor-pointer px-[18px] py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-neutral-100 disabled:opacity-50"
                >
                    Export as PDF
                </button>
            </div>

            <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                <div
                    className={cn(
                        GRID,
                        'border-divider text-text/74 min-w-[560px] border-b bg-neutral-100 px-[18px] py-[11px] text-[11px] font-bold tracking-[.1em] uppercase',
                    )}
                >
                    <div>Transfer</div>
                    <div>Route</div>
                    <div className="text-right">Lines</div>
                    <div>Status</div>
                    <div />
                </div>
                {rows.map((transfer) => (
                    <div key={transfer.id} className={cn(GRID, 'border-divider min-w-[560px] items-center border-b px-[18px] py-3')}>
                        <div className="min-w-0">
                            <div className="text-[13.5px] font-semibold">{transfer.no}</div>
                            <div className="text-text/74 text-[11.5px] tabular-nums">{transfer.day}</div>
                        </div>
                        <div className="min-w-0">
                            <div className="text-[13px]">
                                {transfer.from.name} → {transfer.to.name}
                            </div>
                            <div className="text-text/74 text-[11.5px]">{transfer.kind}</div>
                        </div>
                        <div className="text-right text-[13px] tabular-nums">{transfer.lines.length}</div>
                        <div>
                            <span
                                className={cn('rounded-btn inline-block px-2.5 py-1 text-[11.5px] whitespace-nowrap', STATUS_TONE[transfer.status])}
                            >
                                {transfer.status_label}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => printSlip(transfer)}
                            className="border-divider bg-bg rounded-btn hover:border-accent min-h-9 cursor-pointer justify-self-end border px-[11px] py-1.5 text-xs whitespace-nowrap"
                        >
                            Slip
                        </button>
                    </div>
                ))}
                {rows.length === 0 && <div className="text-text/74 p-[34px] text-center text-[13.5px]">No transfers match these filters.</div>}
            </div>
        </div>
    );
}
