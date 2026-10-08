import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { trim, type BatchRow, type Location, type ProductRow, type ScreenData } from '@/lib/inventory';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const BATCH_TONE: Record<BatchRow['status'], string> = {
    to_produce: 'bg-neutral-200 text-neutral-800',
    in_production: 'bg-neutral-200 text-neutral-800',
    ready: 'bg-accent-100 text-accent-700',
    delivered: 'bg-accent-2-100 text-accent-2-700',
};

const batchesWord = (n: number) => `${trim(n)} ${n === 1 ? 'batch' : 'batches'}`;

const stamp = (iso: string) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/**
 * The commissary: each semi-finished product's recipe against the warehouse's stock (Production), and the
 * batches logged to make (Batches).
 */
export function Production({
    data,
    location,
    view,
    onView,
    toast,
}: {
    data: ScreenData<'cm'>;
    location: Location;
    view: 'recipe' | 'batch';
    onView: (view: 'recipe' | 'batch' | 'xfer') => void;
    toast: (message: string) => void;
}) {
    const { send, processing } = useBackOfficeAction(toast);
    const products = data.products ?? [];
    const batches = data.batches ?? [];

    if (view === 'batch') {
        const open = batches.filter((batch) => batch.status !== 'delivered').length;

        return (
            <div className="flex flex-col gap-3.5">
                <div className="text-text/74 text-[12.5px]">
                    {batches.length
                        ? `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'} logged · ${open ? `${open} not yet delivered` : 'all delivered to the warehouse'}`
                        : 'Nothing logged yet — set a batch on Production and log it as produced.'}
                </div>
                <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                    <div className="text-text/74 grid min-w-[560px] grid-cols-[minmax(150px,2.4fr)_minmax(80px,.9fr)_minmax(76px,1fr)_minmax(84px,100px)_minmax(0,112px)] gap-2.5 bg-neutral-100 px-[18px] py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                        <div>Semi-finished product</div>
                        <div>Produced</div>
                        <div>To stock</div>
                        <div className="text-right">Status</div>
                        <div />
                    </div>
                    {batches.map((batch) => {
                        const product = products.find((candidate) => candidate.id === batch.product_id);
                        const step = (name: 'start' | 'ready' | 'deliver', success: string) =>
                            send('patch', route('inventory.batches.advance', batch.id), { step: name }, { success });

                        return (
                            <div
                                key={batch.id}
                                className="border-divider grid min-w-[560px] grid-cols-[minmax(150px,2.4fr)_minmax(80px,.9fr)_minmax(76px,1fr)_minmax(84px,100px)_minmax(0,112px)] items-center gap-2.5 border-t px-[18px] py-3"
                            >
                                <div className="min-w-0">
                                    <div className="text-[13px]">{batch.name}</div>
                                    <div className="text-text/74 text-[11.5px]">
                                        {stamp(batch.logged_at)}
                                        {batch.transfer_no ? ` · ${batch.transfer_no}` : ''}
                                    </div>
                                </div>
                                <div className="text-[13px] tabular-nums">{batchesWord(batch.batches)}</div>
                                <div className="min-w-0">
                                    <div className="text-[13px] tabular-nums">
                                        {product?.stock_per_batch
                                            ? `${trim(batch.batches * product.stock_per_batch)} ${product.unit}`
                                            : 'stock qty not set'}
                                    </div>
                                    <div className="text-text/74 text-[11.5px] tabular-nums">
                                        {product?.servings_per_batch
                                            ? `${trim(Math.floor(batch.batches * product.servings_per_batch))} servings`
                                            : 'servings not set'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span
                                        className={cn(
                                            'rounded-btn inline-block px-2.5 py-1 text-[11.5px] whitespace-nowrap',
                                            BATCH_TONE[batch.status],
                                        )}
                                    >
                                        {batch.status_label}
                                    </span>
                                </div>
                                <div className="flex justify-end">
                                    {location.can && batch.status === 'to_produce' && (
                                        <BatchButton disabled={processing} onClick={() => step('start', `Production started — ${batch.name}`)}>
                                            Start
                                        </BatchButton>
                                    )}
                                    {location.can && batch.status === 'in_production' && (
                                        <BatchButton disabled={processing} onClick={() => step('ready', `${batch.name} ready to deliver`)}>
                                            Mark ready
                                        </BatchButton>
                                    )}
                                    {location.can && batch.status === 'ready' && (
                                        <BatchButton
                                            primary
                                            disabled={processing}
                                            onClick={() => step('deliver', `${batch.name} sent to the warehouse`)}
                                        >
                                            To warehouse
                                        </BatchButton>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {batches.length === 0 && <div className="text-text/74 px-[18px] py-[34px] text-center text-[13.5px]">No batches posted yet.</div>}
                </div>
            </div>
        );
    }

    return <Recipes data={data} location={location} onView={onView} send={send} processing={processing} />;
}

function BatchButton({ primary, disabled, onClick, children }: { primary?: boolean; disabled: boolean; onClick: () => void; children: string }) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'rounded-btn min-h-9 cursor-pointer px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-50',
                primary ? 'bg-accent text-neutral-100' : 'border-divider bg-bg hover:border-accent hover:text-accent-800 border',
            )}
        >
            {children}
        </button>
    );
}

function Recipes({
    data,
    location,
    onView,
    send,
    processing,
}: {
    data: ScreenData<'cm'>;
    location: Location;
    onView: (view: 'recipe' | 'batch' | 'xfer') => void;
    send: ReturnType<typeof useBackOfficeAction>['send'];
    processing: boolean;
}) {
    const products = data.products ?? [];
    const choices = data.ingredientChoices ?? [];
    const warehouse = data.locations.wh;
    const [selectedId, setSelectedId] = useState<number | null>(products[0]?.id ?? null);
    const [batch, setBatch] = useState(10);
    const [off, setOff] = useState<Record<number, boolean>>({});
    const [adding, setAdding] = useState<{ query: string; id: number | null; qty: string; open: boolean }>({
        query: '',
        id: null,
        qty: '',
        open: false,
    });
    const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
    const [removing, setRemoving] = useState<ProductRow | null>(null);

    const product = products.find((candidate) => candidate.id === selectedId) ?? products[0] ?? null;
    const rows = (product?.ingredients ?? []).map((part) => {
        const item = choices.find((choice) => choice.id === part.stock_item_id);
        const need = part.qty * batch;
        const have = item?.at_warehouse ?? 0;

        return {
            ...part,
            name: item?.name ?? 'Removed item',
            sku: item?.at_warehouse === null || !item ? 'Not in warehouse' : item.sku,
            unit: item?.unit ?? '',
            need,
            have,
            short: Math.max(0, need - have),
            on: !off[part.stock_item_id],
            stocked: item?.at_warehouse !== null && item !== undefined,
        };
    });
    const shortCount = rows.filter((row) => row.short > 0).length;
    const picked = rows.filter((row) => row.on && row.stocked);
    const terms = adding.query.trim().toLowerCase();
    const options = choices
        .filter((choice) => choice.at_warehouse !== null && !rows.some((row) => row.stock_item_id === choice.id))
        .filter((choice) => !terms || `${choice.name} ${choice.sku} ${choice.category}`.toLowerCase().includes(terms))
        .slice(0, 8);
    const chosen = choices.find((choice) => choice.id === adding.id) ?? null;

    const saveRecipe = (ingredients: { stock_item_id: number; qty: number }[], success?: string) =>
        product && send('put', route('inventory.products.recipe', product.id), { ingredients }, { success });

    const select = (id: number) => {
        setSelectedId(id);
        setBatch(10);
        setOff({});
        setAdding({ query: '', id: null, qty: '', open: false });
    };

    return (
        <div className="flex flex-wrap items-start gap-5">
            <div className="border-divider bg-surface min-w-0 flex-[0_1_clamp(230px,25vw,312px)] overflow-hidden rounded-md border">
                <div className="text-text/74 flex items-center gap-2.5 bg-neutral-100 py-[9px] pr-3 pl-4 text-[11.5px] font-bold tracking-[.07em] uppercase">
                    <span className="flex-1">Product</span>
                    {location.can && (
                        <button
                            type="button"
                            onClick={() => setEditing('new')}
                            className="border-divider bg-surface text-text rounded-btn hover:border-accent hover:text-accent-800 flex-none cursor-pointer border px-2.5 py-[5px] text-[11.5px] font-semibold tracking-normal whitespace-nowrap normal-case"
                        >
                            New product
                        </button>
                    )}
                </div>
                {products.map((candidate) => {
                    const on = candidate.id === product?.id;

                    return (
                        <div
                            key={candidate.id}
                            className={cn('border-divider flex items-center gap-1.5 border-t pr-2.5', on ? 'bg-accent-100' : 'bg-transparent')}
                        >
                            <button
                                type="button"
                                onClick={() => select(candidate.id)}
                                aria-current={on ? 'true' : undefined}
                                className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 bg-transparent py-[11px] pr-1.5 pl-4 text-left"
                            >
                                <div className={cn('min-w-0 flex-1 text-[13.5px]', on ? 'font-semibold' : 'font-medium')}>{candidate.name}</div>
                                {candidate.ingredients.length === 0 && (
                                    <span className="rounded-btn bg-neutral-200 px-2 py-[3px] text-[11.5px] whitespace-nowrap text-neutral-800">
                                        No recipe
                                    </span>
                                )}
                            </button>
                            {location.can && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setEditing(candidate)}
                                        className="border-divider bg-surface rounded-btn hover:border-accent hover:text-accent-800 flex-none cursor-pointer border px-[9px] py-1 text-[11.5px]"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        title="Remove product"
                                        aria-label={`Remove ${candidate.name}`}
                                        onClick={() => setRemoving(candidate)}
                                        className="border-divider rounded-btn hover:border-accent hover:text-accent-800 size-6 flex-none cursor-pointer border bg-transparent text-xs"
                                    >
                                        ×
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
                {products.length === 0 && (
                    <div className="text-text/74 border-divider border-t px-4 py-6 text-center text-[13px]">No products yet.</div>
                )}
            </div>

            {product && (
                <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-3.5">
                    <div className="border-divider bg-surface rounded-md border p-[18px]">
                        <div className="flex flex-wrap items-end gap-x-5 gap-y-3.5">
                            <div className="min-w-0 flex-[1_1_200px]">
                                <div className="text-text/74 text-[11.5px] tracking-[.07em] uppercase">
                                    {product.category} · {product.sku}
                                </div>
                                <h3 className="mt-[3px] mb-0 text-[19px] leading-[1.15]">{product.name}</h3>
                                <div className="text-text/74 mt-1 text-[12.5px]">
                                    Made at the commissary, stored at the warehouse
                                    {product.servings_per_batch ? ` · ${trim(product.servings_per_batch)} servings per batch` : ''}
                                </div>
                            </div>
                            <div className="flex-none">
                                <div className="text-text/74 mb-[5px] text-[11.5px] tracking-[.07em] uppercase">Batch to make</div>
                                <div className="flex items-center gap-[7px]">
                                    <button
                                        type="button"
                                        aria-label="One batch less"
                                        onClick={() => setBatch(Math.max(0, batch - 1))}
                                        className="border-divider bg-bg size-9 cursor-pointer rounded-full border text-[15px]"
                                    >
                                        −
                                    </button>
                                    <input
                                        aria-label="Batches to make"
                                        inputMode="decimal"
                                        value={trim(batch)}
                                        onChange={(event) => setBatch(Math.max(0, parseFloat(event.target.value.replace(/[^0-9.]/g, '')) || 0))}
                                        className="border-divider bg-surface text-text rounded-btn w-[62px] border px-0.5 py-1 text-center text-base font-semibold tabular-nums"
                                    />
                                    <button
                                        type="button"
                                        aria-label="One batch more"
                                        onClick={() => setBatch(batch + 1)}
                                        className="border-divider bg-bg size-9 cursor-pointer rounded-full border text-[15px]"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                        <div className="border-divider flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 pt-[13px] pb-3">
                            <div className="text-sm font-semibold">
                                {product.servings_per_batch
                                    ? `${trim(batch)} ${batch === 1 ? 'batch yields' : 'batches yield'} ${trim(Math.floor(batch * product.servings_per_batch))} servings`
                                    : 'Servings per batch not set yet'}
                            </div>
                            {product.serving_size && (
                                <div className="text-text/74 text-[12.5px]">
                                    {product.serving_size}
                                    {product.serving_unit ? ` ${product.serving_unit}` : ''} per serving
                                </div>
                            )}
                        </div>
                        <div className="text-text/74 grid min-w-[520px] grid-cols-[30px_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(74px,104px)_28px] gap-2.5 bg-neutral-100 px-4 py-3 text-[11.5px] font-bold tracking-[.07em] uppercase">
                            <div />
                            <div>Ingredient</div>
                            <div className="text-right">Per batch</div>
                            <div className="text-right">Needed</div>
                            <div className="text-right">Warehouse stock</div>
                            <div className="text-right">Short by</div>
                            <div />
                        </div>
                        {rows.map((row) => (
                            <div
                                key={`${product.id}-${row.stock_item_id}`}
                                className={cn(
                                    'border-divider grid min-w-[520px] grid-cols-[30px_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(74px,104px)_28px] items-center gap-2.5 border-t px-4 py-[11px]',
                                    !row.on && 'bg-neutral-100',
                                )}
                            >
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={row.on}
                                    aria-label={`Request ${row.name}`}
                                    onClick={() => setOff({ ...off, [row.stock_item_id]: row.on })}
                                    className={cn(
                                        'rounded-btn flex size-[19px] cursor-pointer items-center justify-center border-[1.5px] text-[11px] leading-none text-neutral-100',
                                        row.on ? 'border-accent bg-accent' : 'border-divider bg-transparent',
                                    )}
                                >
                                    {row.on ? '✓' : ''}
                                </button>
                                <div className="min-w-0">
                                    <div className="text-[13px]">{row.name}</div>
                                    <div className="text-text/74 text-[11.5px]">{row.sku}</div>
                                </div>
                                <div className="flex items-baseline justify-end gap-[3px] text-[13px]">
                                    <input
                                        aria-label={`${row.name} per batch`}
                                        inputMode="decimal"
                                        disabled={!location.can}
                                        defaultValue={trim(row.qty)}
                                        onBlur={(event) => {
                                            const next = parseFloat(event.target.value.replace(/[^0-9.]/g, '')) || 0;

                                            if (next > 0 && next !== row.qty) {
                                                saveRecipe(
                                                    (product.ingredients ?? []).map((part) =>
                                                        part.stock_item_id === row.stock_item_id ? { ...part, qty: next } : part,
                                                    ),
                                                    `${row.name} set to ${trim(next)} per batch`,
                                                );
                                            }
                                        }}
                                        className="hover:border-divider hover:bg-surface focus:border-accent focus:bg-surface rounded-btn w-12 border border-transparent bg-transparent px-[3px] py-0.5 text-right tabular-nums outline-none"
                                    />
                                    <span>{row.unit}</span>
                                </div>
                                <div className="text-right text-[13px] tabular-nums">
                                    {trim(Math.ceil(row.need * 10) / 10)} {row.unit}
                                </div>
                                <div className="text-right text-[13px] tabular-nums">
                                    {trim(row.have)} {row.unit}
                                </div>
                                <div className="text-right">
                                    <span
                                        className={cn(
                                            'rounded-btn inline-block px-2 py-[3px] text-[11.5px] whitespace-nowrap',
                                            row.short > 0 ? 'bg-accent-200 text-accent-900' : 'bg-accent-2-100 text-accent-2-700',
                                        )}
                                    >
                                        {row.short > 0 ? `Short ${trim(Math.ceil(row.short * 10) / 10)} ${row.unit}` : 'Covered'}
                                    </span>
                                </div>
                                {location.can ? (
                                    <button
                                        type="button"
                                        title="Remove ingredient"
                                        aria-label={`Remove ${row.name}`}
                                        onClick={() =>
                                            saveRecipe(
                                                (product.ingredients ?? []).filter((part) => part.stock_item_id !== row.stock_item_id),
                                                `${row.name} removed from the recipe`,
                                            )
                                        }
                                        className="border-divider rounded-btn hover:border-accent hover:text-accent-800 size-6 cursor-pointer justify-self-end border bg-transparent text-xs"
                                    >
                                        ×
                                    </button>
                                ) : (
                                    <div />
                                )}
                            </div>
                        ))}
                        {rows.length === 0 && (
                            <div className="text-text/74 px-[18px] py-[30px] text-center text-[13.5px]">
                                No ingredients yet — add the first one below.
                            </div>
                        )}
                    </div>

                    {location.can && (
                        <div className="border-divider bg-surface flex flex-wrap items-center gap-2 rounded-md border px-4 py-3">
                            <div className="relative min-w-0 flex-[1_1_220px]">
                                <div className="border-divider bg-surface rounded-btn flex items-center gap-1.5 border pr-2 pl-[9px]">
                                    <input
                                        aria-label="Search warehouse ingredients"
                                        placeholder="Search warehouse ingredients"
                                        value={chosen ? chosen.name : adding.query}
                                        onChange={(event) => setAdding({ ...adding, query: event.target.value, id: null, open: true })}
                                        onFocus={() => setAdding({ ...adding, open: true })}
                                        onBlur={() => setTimeout(() => setAdding((current) => ({ ...current, open: false })), 200)}
                                        className="text-text min-w-0 flex-1 border-0 bg-transparent py-[7px] text-[12.5px] outline-none"
                                    />
                                    {(chosen || adding.query) && (
                                        <button
                                            type="button"
                                            aria-label="Clear"
                                            onClick={() => setAdding({ ...adding, query: '', id: null, open: false })}
                                            className="text-text/74 flex size-[18px] flex-none cursor-pointer items-center justify-center bg-transparent p-0 text-[13px]"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                {adding.open && !chosen && (
                                    <div className="border-divider bg-surface rounded-btn absolute top-[calc(100%+4px)] right-0 left-0 z-30 flex max-h-[236px] flex-col overflow-hidden overflow-y-auto border shadow-[var(--shadow-md)]">
                                        {options.map((option) => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    setAdding({ ...adding, id: option.id, query: '', open: false });
                                                }}
                                                className="border-divider cursor-pointer border-b bg-transparent px-[11px] py-[9px] text-left hover:bg-neutral-100"
                                            >
                                                <div className="text-[13px]">{option.name}</div>
                                                <div className="text-text/74 text-[11.5px]">
                                                    {option.category} · {trim(option.at_warehouse ?? 0)} {option.unit} on hand
                                                </div>
                                            </button>
                                        ))}
                                        {options.length === 0 && (
                                            <div className="text-text/74 p-3 text-center text-[12.5px]">No warehouse item matches that.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input
                                aria-label="Quantity per batch"
                                inputMode="decimal"
                                placeholder="0"
                                value={adding.qty}
                                onChange={(event) => setAdding({ ...adding, qty: event.target.value.replace(/[^0-9.]/g, '') })}
                                className="border-divider bg-surface text-text rounded-btn w-[70px] flex-none border px-[9px] py-[7px] text-right text-[12.5px] tabular-nums"
                            />
                            <span className="text-text/74 flex-none text-xs">per batch</span>
                            <button
                                type="button"
                                disabled={!chosen || !(parseFloat(adding.qty) > 0) || processing}
                                onClick={() => {
                                    if (!chosen) {
                                        return;
                                    }

                                    saveRecipe(
                                        [...(product.ingredients ?? []), { stock_item_id: chosen.id, qty: parseFloat(adding.qty) }],
                                        `${chosen.name} added to ${product.name}`,
                                    );
                                    setAdding({ query: '', id: null, qty: '', open: false });
                                }}
                                className="border-divider bg-surface rounded-btn hover:border-accent hover:text-accent-800 min-h-9 flex-none cursor-pointer border px-[13px] py-[7px] text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-50"
                            >
                                Add ingredient
                            </button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                        <div className="text-text/74 flex-[1_1_200px] text-[12.5px]">
                            {rows.length
                                ? `${batchesWord(batch)} ${batch === 1 ? 'needs' : 'need'} ${rows.length} ${rows.length === 1 ? 'ingredient' : 'ingredients'} · ${shortCount ? `${shortCount} short at the warehouse` : 'all covered by warehouse stock'}`
                                : 'Add a recipe to request ingredients for this product.'}
                        </div>
                        {location.can && batch > 0 && (
                            <button
                                type="button"
                                disabled={processing}
                                onClick={() =>
                                    send(
                                        'post',
                                        route('inventory.batches.store', product.id),
                                        { batches: batch },
                                        {
                                            success: `${batchesWord(batch)} of ${product.name} added to Batches`,
                                            onSuccess: () => onView('batch'),
                                        },
                                    )
                                }
                                className="border-divider bg-bg rounded-btn hover:border-accent hover:text-accent-800 min-h-11 cursor-pointer border px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap"
                            >
                                Log {batchesWord(batch)} to produce
                            </button>
                        )}
                        {location.can && warehouse && picked.length > 0 && (
                            <button
                                type="button"
                                disabled={processing}
                                onClick={() =>
                                    send(
                                        'post',
                                        route('inventory.requisitions.store', location.id),
                                        {
                                            from_branch_id: warehouse.id,
                                            lines: picked.map((row) => ({ stock_item_id: row.stock_item_id, qty: Math.ceil(row.need * 10) / 10 })),
                                        },
                                        {
                                            success: `Requested ${picked.length} ${picked.length === 1 ? 'line' : 'lines'} from ${warehouse.name}`,
                                            onSuccess: () => onView('xfer'),
                                        },
                                    )
                                }
                                className="bg-accent hover:bg-accent-700 rounded-btn min-h-11 cursor-pointer px-[17px] py-2.5 text-[13px] font-semibold whitespace-nowrap text-neutral-100"
                            >
                                Request {picked.length} {picked.length === 1 ? 'line' : 'lines'} from Warehouse
                            </button>
                        )}
                    </div>
                </div>
            )}

            <ProductSheet
                key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
                product={editing}
                units={data.units ?? []}
                busy={processing}
                onClose={() => setEditing(null)}
                onSave={(fields) => {
                    const isNew = editing === 'new';
                    send(
                        isNew ? 'post' : 'put',
                        isNew ? route('inventory.products.store') : route('inventory.products.update', (editing as ProductRow).id),
                        fields,
                        {
                            success: `${fields.name} ${isNew ? 'added' : 'updated'}`,
                            onSuccess: () => setEditing(null),
                        },
                    );
                }}
            />
            <ConfirmDialog
                open={removing !== null}
                title="Remove this product?"
                body={
                    removing ? `${removing.name} · ${removing.category} · ${removing.sku}. Its recipe goes too; stock the warehouse holds stays.` : ''
                }
                cancelLabel="Keep it"
                confirmLabel="Remove"
                onCancel={() => setRemoving(null)}
                onConfirm={() =>
                    removing &&
                    send(
                        'delete',
                        route('inventory.products.destroy', removing.id),
                        {},
                        { success: `${removing.name} removed`, onSuccess: () => setRemoving(null) },
                    )
                }
            />
        </div>
    );
}

function ProductSheet({
    product,
    units,
    busy,
    onClose,
    onSave,
}: {
    product: ProductRow | 'new' | null;
    units: string[];
    busy: boolean;
    onClose: () => void;
    onSave: (fields: Record<string, string | number | null> & { name: string }) => void;
}) {
    const existing = product && product !== 'new' ? product : null;
    const [fields, setFields] = useState({
        name: existing?.name ?? '',
        servings_per_batch: existing?.servings_per_batch ? trim(existing.servings_per_batch) : '',
        serving_size: existing?.serving_size ?? '',
        serving_unit: existing?.serving_unit ?? '',
        stock_per_batch: existing?.stock_per_batch ? trim(existing.stock_per_batch) : '',
        unit: existing?.unit ?? 'L',
    });
    const number = (value: string) => (value.trim() === '' ? null : parseFloat(value) || null);
    const inputs: { key: keyof typeof fields; label: string; placeholder: string }[] = [
        { key: 'name', label: 'Product name', placeholder: 'e.g. Ube halaya filling' },
        { key: 'servings_per_batch', label: 'Servings per batch', placeholder: 'e.g. 5 — servings from one batch' },
        { key: 'serving_size', label: 'Serving size', placeholder: 'e.g. 200' },
        { key: 'serving_unit', label: 'Serving unit', placeholder: 'g, ml, pc' },
        { key: 'stock_per_batch', label: 'Stock per batch', placeholder: 'e.g. 5 — quantity added to warehouse stock' },
    ];

    return (
        <Sheet
            open={product !== null}
            onClose={onClose}
            title={existing ? 'Edit product' : 'New semi-finished product'}
            description={
                existing
                    ? 'Changes apply to the recipe and to warehouse stock created from it.'
                    : 'The commissary produces it; the warehouse stores it.'
            }
            width="max-w-[440px]"
        >
            <div className="flex flex-col gap-3.5">
                {inputs.map((input) => (
                    <div key={input.key} className="field">
                        <label htmlFor={`product-${input.key}`}>{input.label}</label>
                        <input
                            id={`product-${input.key}`}
                            className="input w-full"
                            placeholder={input.placeholder}
                            value={fields[input.key]}
                            onChange={(event) => setFields({ ...fields, [input.key]: event.target.value })}
                        />
                    </div>
                ))}
                <div className="field">
                    <label htmlFor="product-unit">Stock unit</label>
                    <select
                        id="product-unit"
                        className="input min-h-11 w-full"
                        value={fields.unit}
                        onChange={(event) => setFields({ ...fields, unit: event.target.value })}
                    >
                        {units.map((unit) => (
                            <option key={unit} value={unit}>
                                {unit}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="mt-6 flex gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary flex-none px-[18px] py-[11px] text-[13.5px]">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={busy || !fields.name.trim()}
                    onClick={() =>
                        onSave({
                            name: fields.name.trim(),
                            servings_per_batch: number(fields.servings_per_batch),
                            serving_size: fields.serving_size.trim() || null,
                            serving_unit: fields.serving_unit.trim() || null,
                            stock_per_batch: number(fields.stock_per_batch),
                            unit: fields.unit,
                        })
                    }
                    className="btn btn-primary flex-1 p-3 text-sm font-semibold disabled:opacity-50"
                >
                    {existing ? 'Save product' : 'Add product'}
                </button>
            </div>
        </Sheet>
    );
}
