import { type Part, type StockChoice } from '@/lib/back-office';
import { firstError, peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { useState, type ReactNode } from 'react';

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('text-text/74 mb-[9px] text-[11.5px] tracking-[.08em] uppercase', className)}>{children}</div>;
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn('border-divider rounded-md border bg-neutral-100', className)}>{children}</div>;
}

/** An on/off switch with its state written beside it. */
export function Toggle({ on, label, onToggle, disabled }: { on: boolean; label: string; onToggle: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            disabled={disabled}
            onClick={onToggle}
            className="text-text flex min-h-11 cursor-pointer items-center gap-2 bg-transparent px-1 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
            <span
                className={cn(
                    'flex h-6 w-[42px] rounded-full p-[3px] transition-colors',
                    on ? 'bg-accent-2-500 justify-end' : 'justify-start bg-neutral-300',
                )}
            >
                <span className="bg-bg size-[18px] rounded-full shadow-[var(--shadow-sm)]" />
            </span>
            <span className="w-6 text-left">{on ? 'On' : 'Off'}</span>
        </button>
    );
}

export function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className="border-divider hover:border-accent hover:text-accent-700 size-10 flex-none cursor-pointer rounded-full border bg-transparent text-[15px] disabled:cursor-not-allowed disabled:opacity-40"
        >
            ×
        </button>
    );
}

/**
 * Ingredients per serving: the stock items one serving uses, for recipes and add-ons.
 */
export function PartsEditor({
    parts,
    stockItems,
    onChange,
    disabled,
    emptyText,
}: {
    parts: Part[];
    stockItems: StockChoice[];
    onChange: (parts: Part[]) => void;
    disabled?: boolean;
    emptyText: string;
}) {
    const [adding, setAdding] = useState('');
    const available = stockItems.filter((item) => !parts.some((part) => part.stock_item_id === item.id));
    const cost = parts.reduce((sum, part) => sum + (stockItems.find((item) => item.id === part.stock_item_id)?.cost ?? 0) * part.qty, 0);

    return (
        <div>
            <div className="mb-[9px] flex items-baseline justify-between">
                <SectionLabel className="mb-0">Ingredients per serving</SectionLabel>
                {parts.length > 0 && <div className="text-text/74 text-xs tabular-nums">cost {peso(cost)}</div>}
            </div>
            <div className="mb-2.5 flex flex-col gap-2">
                {parts.map((part, index) => {
                    const item = stockItems.find((candidate) => candidate.id === part.stock_item_id);

                    return (
                        <div key={part.stock_item_id} className="flex items-center gap-2.5">
                            <div className="min-w-0 flex-1 text-sm">{item?.name ?? 'Removed item'}</div>
                            <input
                                className="input w-[86px] text-right tabular-nums"
                                aria-label={`${item?.name} per serving`}
                                inputMode="decimal"
                                disabled={disabled}
                                defaultValue={part.qty}
                                onBlur={(event) =>
                                    onChange(
                                        parts.map((p, i) =>
                                            i === index ? { ...p, qty: parseFloat(event.target.value.replace(/[^0-9.]/g, '')) || 0 } : p,
                                        ),
                                    )
                                }
                            />
                            <div className="text-text/74 w-[34px] text-[12.5px]">{item?.unit}</div>
                            <RemoveButton
                                label={`Remove ${item?.name}`}
                                disabled={disabled}
                                onClick={() => onChange(parts.filter((_, i) => i !== index))}
                            />
                        </div>
                    );
                })}
            </div>
            {parts.length === 0 && <p className="text-text/74 mt-0 mb-2.5 text-[13px]">{emptyText}</p>}
            {!disabled && (
                <div className="flex gap-2">
                    <select
                        className="input min-w-0 flex-1"
                        aria-label="Ingredient to add"
                        value={adding}
                        onChange={(event) => setAdding(event.target.value)}
                    >
                        <option value="">Add an ingredient from stock</option>
                        {available.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!adding}
                        onClick={() => {
                            onChange([...parts, { stock_item_id: Number(adding), qty: 1 }]);
                            setAdding('');
                        }}
                        className="btn btn-secondary px-5 py-[11px] text-[13.5px] font-semibold disabled:opacity-50"
                    >
                        Add
                    </button>
                </div>
            )}
        </div>
    );
}

type Method = 'post' | 'put' | 'patch' | 'delete';

/**
 * Send a back-office change. The server redirects back to the same tab with fresh data; errors and
 * the success message show in the till's toast.
 */
export function useBackOfficeAction(toast: (message: string) => void) {
    const [processing, setProcessing] = useState(false);

    const send = (
        method: Method,
        url: string,
        data: Record<string, unknown>,
        options: { success?: string; onSuccess?: () => void; forceFormData?: boolean } = {},
    ) => {
        const visit = {
            preserveScroll: true,
            preserveState: true,
            forceFormData: options.forceFormData,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                if (options.success) {
                    toast(options.success);
                }

                options.onSuccess?.();
            },
            onError: (errors: Record<string, string>) => toast(firstError(errors)),
        };

        if (method === 'delete') {
            router.delete(url, visit);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router[method](url, data as any, visit);
        }
    };

    return { send, processing };
}
