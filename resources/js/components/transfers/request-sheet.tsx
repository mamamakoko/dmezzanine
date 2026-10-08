import { Sheet } from '@/components/till/sheet';
import { type Source } from '@/lib/transfers';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface RequestSheetProps {
    open: boolean;
    /** The locations stock can be requested from, with what each holds. */
    sources: Source[];
    destination: string;
    onClose: () => void;
    onSubmit: (sourceId: number, lines: { stock_item_id: number; qty: number }[]) => void;
    busy?: boolean;
}

/**
 * Request stock: pick the source, then a quantity of any of the items it holds. The source approves and
 * issues the requisition.
 */
export function RequestSheet({ open, sources, destination, onClose, onSubmit, busy }: RequestSheetProps) {
    const [sourceId, setSourceId] = useState<number | null>(null);
    const [qtys, setQtys] = useState<Record<number, number>>({});
    const [query, setQuery] = useState('');

    const source = sources.find((candidate) => candidate.id === sourceId) ?? sources[0];
    const terms = query.trim().toLowerCase();
    const items = (source?.items ?? []).filter((item) => !terms || `${item.name} ${item.sku} ${item.category}`.toLowerCase().includes(terms));
    const lines = Object.entries(qtys)
        .filter(([, amount]) => amount > 0)
        .map(([id, amount]) => ({ stock_item_id: Number(id), qty: amount }));

    const setQty = (id: number, amount: number) =>
        setQtys((current) => {
            const next = { ...current };

            if (amount > 0) {
                next[id] = amount;
            } else {
                delete next[id];
            }

            return next;
        });

    const close = () => {
        setQtys({});
        setQuery('');
        onClose();
    };

    return (
        <Sheet
            open={open}
            onClose={close}
            title={source ? `Request stock from ${source.name}` : 'Request stock'}
            description={source ? `Requisition raised for ${destination} · ${source.name} approves and issues` : undefined}
            width="max-w-[620px]"
            className="z-[64] flex flex-col overflow-hidden p-0"
        >
            <div className="border-divider -mt-[18px] border-b px-6 pb-4">
                {sources.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                        {sources.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                    setSourceId(option.id);
                                    setQtys({});
                                }}
                                className={cn(
                                    'rounded-btn min-h-10 cursor-pointer border px-[15px] py-2 text-[12.5px] font-semibold whitespace-nowrap',
                                    option.id === source?.id ? 'border-accent bg-accent text-neutral-100' : 'border-divider text-text bg-transparent',
                                )}
                            >
                                {option.name}
                            </button>
                        ))}
                    </div>
                )}
                <input
                    className="input mt-3 w-full text-[13px]"
                    placeholder="Search item, SKU or category"
                    aria-label="Search items"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-6 pt-2 pb-3">
                {items.map((item) => {
                    const amount = qtys[item.id] ?? 0;

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                'rounded-btn mt-1.5 flex items-center gap-3 border px-[11px] py-2.5',
                                amount ? 'border-accent-300 bg-accent-200' : 'border-divider bg-transparent',
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-[13.5px]">{item.name}</div>
                                <div className="text-text/74 text-[11.5px] tabular-nums">
                                    {item.sku} · {+item.on_hand.toFixed(3)} {item.unit} on hand
                                </div>
                            </div>
                            <div className="flex flex-none items-center gap-1.5">
                                <button
                                    type="button"
                                    aria-label={`Less ${item.name}`}
                                    onClick={() => setQty(item.id, Math.max(0, amount - 1))}
                                    className="border-divider bg-bg rounded-btn size-9 cursor-pointer border text-sm"
                                >
                                    −
                                </button>
                                <input
                                    aria-label={`${item.name} quantity`}
                                    inputMode="decimal"
                                    value={amount ? String(amount) : '0'}
                                    onChange={(event) => setQty(item.id, Math.max(0, parseFloat(event.target.value.replace(/[^0-9.]/g, '')) || 0))}
                                    className="border-divider bg-surface text-text rounded-btn w-[52px] border px-1 py-1.5 text-center text-[13px] tabular-nums"
                                />
                                <button
                                    type="button"
                                    aria-label={`More ${item.name}`}
                                    onClick={() => setQty(item.id, amount + 1)}
                                    className="border-divider bg-bg rounded-btn size-9 cursor-pointer border text-sm"
                                >
                                    +
                                </button>
                                <span className="text-text/74 w-[34px] text-[11.5px]">{item.unit}</span>
                            </div>
                        </div>
                    );
                })}
                {items.length === 0 && <div className="text-text/74 py-7 text-center text-[13px]">No matching items at that location</div>}
            </div>
            <div className="border-divider flex gap-2.5 border-t px-6 pt-4 pb-5">
                <button type="button" onClick={close} className="btn btn-secondary flex-none px-[18px] py-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={!lines.length || busy || !source}
                    onClick={() => source && onSubmit(source.id, lines)}
                    className="btn btn-primary flex-1 p-3 text-[13.5px] font-semibold disabled:opacity-50"
                >
                    {lines.length ? `Raise request · ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}` : 'Raise request'}
                </button>
            </div>
        </Sheet>
    );
}
