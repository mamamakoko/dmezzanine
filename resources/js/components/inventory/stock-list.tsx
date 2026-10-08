import { useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { omit, stockTag, trim, type HeldItem, type Location, type ScreenData } from '@/lib/inventory';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type SortKey = 'name' | 'category' | 'unit' | 'on_hand' | 'status' | 'value';

const COLUMNS: { key: SortKey; label: string; end?: boolean }[] = [
    { key: 'name', label: 'Item' },
    { key: 'category', label: 'Category' },
    { key: 'unit', label: 'Unit' },
    { key: 'on_hand', label: 'On hand' },
    { key: 'status', label: 'Status' },
    { key: 'value', label: 'Value', end: true },
];

const GRID =
    'grid grid-cols-[minmax(104px,1.5fr)_minmax(56px,88px)_minmax(30px,52px)_minmax(96px,132px)_minmax(76px,110px)_minmax(56px,92px)_76px] gap-2';

const rankOf = (item: HeldItem) => (item.on_hand <= item.critical_level ? 0 : item.on_hand <= item.par ? 1 : 2);

const sortValue = (item: HeldItem, key: SortKey): string | number =>
    ({
        name: item.name.toLowerCase(),
        category: item.category.toLowerCase(),
        unit: item.unit.toLowerCase(),
        on_hand: item.on_hand,
        status: rankOf(item),
        value: item.on_hand * item.cost,
    })[key];

/**
 * The warehouse's stock: category chips, sortable columns, on-hand steppers, each item's packaging, and
 * adding, editing and removing items.
 */
export function StockList({
    data,
    location,
    query,
    toast,
}: {
    data: ScreenData<'wh'>;
    location: Location;
    query: string;
    toast: (message: string) => void;
}) {
    const items = data.items ?? [];
    const [category, setCategory] = useState('All');
    const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });
    const [openId, setOpenId] = useState<number | null>(null);
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [menuOpen, setMenuOpen] = useState(false);
    const [editing, setEditing] = useState<HeldItem | 'new' | null>(null);
    const [removing, setRemoving] = useState<HeldItem | null>(null);
    const [categoriesOpen, setCategoriesOpen] = useState(false);
    const { send, processing } = useBackOfficeAction(toast);

    const categories = [...new Set(items.map((item) => item.category))].sort();
    const terms = query.trim().toLowerCase();
    const visible = items
        .filter((item) => category === 'All' || item.category === category)
        .filter((item) => !terms || `${item.name} ${item.sku} ${item.category} ${item.supplier ?? ''}`.toLowerCase().includes(terms))
        .sort((a, b) => {
            const x = sortValue(a, sort.key);
            const y = sortValue(b, sort.key);

            return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1);
        });

    const setOnHand = (item: HeldItem, value: number) => {
        const next = Math.max(0, Math.round(value * 1000) / 1000);

        if (next === item.on_hand) {
            return;
        }

        send(
            'patch',
            route('inventory.items.adjust', item.id),
            { on_hand: next },
            { onSuccess: () => setDrafts((current) => omit(current, item.id)) },
        );
    };

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-3.5">
                <div className="border-divider bg-surface rounded-btn flex flex-wrap gap-1 border p-1">
                    {['All', ...categories].map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => setCategory(name)}
                            className={cn(
                                'rounded-btn min-h-9 cursor-pointer px-[15px] py-[7px] text-[13px] font-semibold whitespace-nowrap',
                                category === name ? 'bg-accent text-neutral-100' : 'text-text bg-transparent',
                            )}
                        >
                            {name}
                        </button>
                    ))}
                </div>
                <div className="text-text/74 text-[12.5px] tabular-nums">
                    {visible.length} items · {peso(visible.reduce((sum, item) => sum + item.on_hand * item.cost, 0))} at cost
                </div>
                <div className="flex-1" />
                {location.can && (
                    <div className="relative">
                        <button
                            type="button"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(!menuOpen)}
                            className="bg-accent rounded-btn flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap text-neutral-100"
                        >
                            Manage stock <span className="text-[10px] opacity-80">▾</span>
                        </button>
                        {menuOpen && (
                            <div className="border-divider bg-surface rounded-btn absolute top-[calc(100%+6px)] right-0 z-30 flex min-w-[186px] origin-top-right flex-col overflow-hidden border shadow-[var(--shadow-md)]">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        setEditing('new');
                                    }}
                                    className="min-h-10 cursor-pointer bg-transparent px-3.5 py-2.5 text-left text-[13px] hover:bg-neutral-100"
                                >
                                    Add item
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMenuOpen(false);
                                        setCategoriesOpen(true);
                                    }}
                                    className="border-divider min-h-10 cursor-pointer border-t bg-transparent px-3.5 py-2.5 text-left text-[13px] hover:bg-neutral-100"
                                >
                                    Manage categories
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="border-divider bg-surface overflow-x-auto rounded-md border">
                <div className={cn(GRID, 'text-text/74 min-w-[640px] bg-neutral-100 px-3.5 py-3 text-[11.5px] font-bold tracking-[.07em] uppercase')}>
                    {COLUMNS.map((column) => (
                        <button
                            key={column.key}
                            type="button"
                            onClick={() => setSort({ key: column.key, desc: sort.key === column.key ? !sort.desc : false })}
                            className={cn(
                                'hover:text-accent-800 flex cursor-pointer items-center gap-[5px] bg-transparent p-0 text-[11.5px] font-bold tracking-[.07em] whitespace-nowrap uppercase',
                                column.end && 'justify-end',
                                sort.key === column.key && 'text-text',
                            )}
                        >
                            {column.label}
                            <span className="text-[9px] opacity-75">{sort.key === column.key ? (sort.desc ? '↓' : '↑') : ''}</span>
                        </button>
                    ))}
                    <div />
                </div>
                {visible.map((item) => {
                    const tag = stockTag(item);
                    const open = openId === item.id;
                    const draft = drafts[item.id];

                    return (
                        <div
                            key={item.id}
                            className={cn('border-divider min-w-[640px] border-t', item.on_hand < item.par * 0.5 && 'bg-accent-100/55')}
                        >
                            <div className={cn(GRID, 'items-center px-3.5 py-[11px]')}>
                                <button
                                    type="button"
                                    aria-expanded={open}
                                    onClick={() => setOpenId(open ? null : item.id)}
                                    className="hover:text-accent-800 min-w-0 cursor-pointer bg-transparent p-0 text-left"
                                >
                                    <div className="text-sm">
                                        {item.name} <span className="text-[9px] opacity-55">{open ? '▲' : '▼'}</span>
                                    </div>
                                    <div className="text-text/74 text-[11.5px]">
                                        {item.sku} · {item.supplier ?? 'No supplier'}
                                    </div>
                                </button>
                                <div className="text-[12.5px]">{item.category}</div>
                                <div className="text-text/74 text-[12.5px]">{item.unit}</div>
                                <div className="flex items-center gap-[7px]">
                                    {location.can ? (
                                        <>
                                            <button
                                                type="button"
                                                aria-label={`One less ${item.name}`}
                                                disabled={processing}
                                                onClick={() => setOnHand(item, item.on_hand - 1)}
                                                className="border-divider bg-bg size-[26px] cursor-pointer rounded-full border text-sm leading-none"
                                            >
                                                −
                                            </button>
                                            <input
                                                aria-label={`${item.name} on hand`}
                                                inputMode="decimal"
                                                value={draft ?? trim(item.on_hand)}
                                                onChange={(event) => setDrafts({ ...drafts, [item.id]: event.target.value.replace(/[^0-9.]/g, '') })}
                                                onBlur={() => draft !== undefined && setOnHand(item, parseFloat(draft) || 0)}
                                                onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
                                                className="border-divider bg-surface text-text rounded-btn w-[52px] border px-0.5 py-[3px] text-center text-[15px] font-semibold tabular-nums"
                                            />
                                            <button
                                                type="button"
                                                aria-label={`One more ${item.name}`}
                                                disabled={processing}
                                                onClick={() => setOnHand(item, item.on_hand + 1)}
                                                className="border-divider bg-bg size-[26px] cursor-pointer rounded-full border text-sm leading-none"
                                            >
                                                +
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-[15px] font-semibold tabular-nums">{trim(item.on_hand)}</span>
                                    )}
                                </div>
                                <div>
                                    <span className={cn('rounded-btn inline-block px-2 py-[3px] text-[11.5px] whitespace-nowrap', tag.className)}>
                                        {tag.label}
                                    </span>
                                </div>
                                <div className="justify-self-end text-[13px] font-semibold tabular-nums">{peso(item.on_hand * item.cost)}</div>
                                <div className="flex gap-1.5 justify-self-end">
                                    {location.can && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setEditing(item)}
                                                className="border-divider bg-bg rounded-btn cursor-pointer border px-2.5 py-[5px] text-xs"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                title="Remove item"
                                                aria-label={`Remove ${item.name}`}
                                                onClick={() => setRemoving(item)}
                                                className="border-divider rounded-btn size-[26px] cursor-pointer border bg-transparent text-[13px]"
                                            >
                                                ×
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {open && (
                                <div className="motion-safe:animate-tin px-3.5 pt-0.5 pb-4">
                                    <div className="border-divider rounded-btn border bg-neutral-100 px-4 py-3.5">
                                        <div className="text-text/74 mb-2.5 text-[11px] tracking-[.09em] uppercase">Packaging</div>
                                        <div className="flex flex-wrap items-start gap-x-[34px] gap-y-3">
                                            {[
                                                ['Packaging', item.pack_name ?? 'Not set'],
                                                ['Units per pack', item.pack_size ? `${trim(item.pack_size)} ${item.unit}` : '—'],
                                                ['Cost per pack', item.pack_size ? peso(item.pack_size * item.cost) : '—'],
                                                [
                                                    'Packs on hand',
                                                    item.pack_size
                                                        ? `${trim(Math.round((item.on_hand / item.pack_size) * 10) / 10)} ${item.pack_name ?? 'pack'}${item.on_hand / item.pack_size === 1 ? '' : 's'}`
                                                        : '—',
                                                ],
                                            ].map(([label, value]) => (
                                                <div key={label} className="min-w-0">
                                                    <div className="text-text/74 text-[11.5px]">{label}</div>
                                                    <div className="mt-0.5 text-sm whitespace-nowrap tabular-nums">{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {visible.length === 0 && <div className="text-text/74 px-[18px] py-[26px] text-center text-[13px]">No items match that search.</div>}
            </div>

            <ItemSheet
                key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
                item={editing}
                location={location}
                categories={categories}
                suppliers={data.suppliers ?? []}
                units={data.units ?? []}
                busy={processing}
                onClose={() => setEditing(null)}
                onSave={(fields) => {
                    const isNew = editing === 'new';
                    send(
                        isNew ? 'post' : 'put',
                        isNew ? route('inventory.items.store', location.id) : route('inventory.items.update', (editing as HeldItem).id),
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
                title="Remove this item?"
                body={removing ? `${removing.name} · ${removing.sku} · ${trim(removing.on_hand)} ${removing.unit} on hand · ${location.name}` : ''}
                cancelLabel="Keep it"
                confirmLabel="Remove"
                onCancel={() => setRemoving(null)}
                onConfirm={() =>
                    removing &&
                    send(
                        'delete',
                        route('inventory.items.destroy', removing.id),
                        {},
                        {
                            success: `${removing.name} removed`,
                            onSuccess: () => setRemoving(null),
                        },
                    )
                }
            />

            <CategoriesSheet
                open={categoriesOpen}
                categories={categories}
                counts={Object.fromEntries(categories.map((name) => [name, items.filter((item) => item.category === name).length]))}
                busy={processing}
                onClose={() => setCategoriesOpen(false)}
                onRename={(from, to, done) =>
                    send(
                        'put',
                        route('inventory.categories.rename', location.id),
                        { from, to },
                        {
                            success: `Renamed to ${to}`,
                            onSuccess: () => {
                                if (category === from) {
                                    setCategory(to);
                                }

                                done();
                            },
                        },
                    )
                }
            />
        </div>
    );
}

interface ItemFields {
    name: string;
    sku: string;
    category: string;
    unit: string;
    on_hand: string;
    par: string;
    critical: string;
    cost: string;
    supplier_id: string;
    pack_name: string;
    pack_size: string;
}

const fieldsOf = (item: HeldItem | 'new' | null, categories: string[], units: string[]): ItemFields =>
    item && item !== 'new'
        ? {
              name: item.name,
              sku: item.sku,
              category: item.category,
              unit: item.unit,
              on_hand: trim(item.on_hand),
              par: trim(item.par),
              critical: item.critical === null ? '' : trim(item.critical),
              cost: String(item.cost),
              supplier_id: item.supplier_id ? String(item.supplier_id) : '',
              pack_name: item.pack_name ?? '',
              pack_size: item.pack_size ? trim(item.pack_size) : '',
          }
        : {
              name: '',
              sku: '',
              category: categories[0] ?? '',
              unit: units[0] ?? 'pc',
              on_hand: '0',
              par: '0',
              critical: '',
              cost: '0',
              supplier_id: '',
              pack_name: '',
              pack_size: '',
          };

function ItemSheet({
    item,
    location,
    categories,
    suppliers,
    units,
    busy,
    onClose,
    onSave,
}: {
    item: HeldItem | 'new' | null;
    location: Location;
    categories: string[];
    suppliers: { id: number; name: string }[];
    units: string[];
    busy: boolean;
    onClose: () => void;
    onSave: (fields: Record<string, string | number | null>) => void;
}) {
    const [fields, setFields] = useState(() => fieldsOf(item, categories, units));
    const isNew = item === 'new';
    const set = (key: keyof ItemFields) => (event: { target: { value: string } }) => setFields({ ...fields, [key]: event.target.value });
    const number = (value: string) => (value.trim() === '' ? null : parseFloat(value) || 0);
    const text: { key: keyof ItemFields; label: string; placeholder: string; numeric?: boolean; list?: string }[] = [
        { key: 'name', label: 'Item name', placeholder: 'e.g. Oat milk, 1L' },
        { key: 'sku', label: 'SKU', placeholder: 'WH-XXX-000 · matches the warehouse' },
        { key: 'category', label: 'Category', placeholder: 'e.g. Dairy', list: 'item-categories' },
        { key: 'on_hand', label: 'On hand', placeholder: '0', numeric: true },
        { key: 'par', label: 'Low level', placeholder: '0', numeric: true },
        { key: 'critical', label: 'Critical level', placeholder: 'Half the low level if left blank', numeric: true },
        { key: 'cost', label: 'Unit cost', placeholder: '0', numeric: true },
        { key: 'pack_name', label: 'Packaging', placeholder: 'sack, case, bag, bottle' },
        { key: 'pack_size', label: 'Units per pack', placeholder: 'e.g. 6 — units in one purchase pack', numeric: true },
    ];

    return (
        <Sheet
            open={item !== null}
            onClose={onClose}
            title={isNew ? 'Add an item' : 'Edit item'}
            description={
                isNew
                    ? `The item is added to ${location.name} stock. An existing item's name or SKU links to it.`
                    : `Changes apply to ${location.name} stock. Name, SKU, category, unit, cost, supplier and packaging change everywhere.`
            }
            width="max-w-[440px]"
        >
            <div className="flex flex-col gap-3.5">
                {text.map((field) => (
                    <div key={field.key} className="field">
                        <label htmlFor={`item-${field.key}`}>{field.label}</label>
                        <input
                            id={`item-${field.key}`}
                            className="input w-full"
                            placeholder={field.placeholder}
                            inputMode={field.numeric ? 'decimal' : undefined}
                            list={field.list}
                            value={fields[field.key]}
                            onChange={set(field.key)}
                        />
                    </div>
                ))}
                <datalist id="item-categories">
                    {categories.map((name) => (
                        <option key={name} value={name} />
                    ))}
                </datalist>
                <div className="field">
                    <label htmlFor="item-unit">Unit</label>
                    <select id="item-unit" className="input min-h-11 w-full" value={fields.unit} onChange={set('unit')}>
                        {(units.includes(fields.unit) ? units : [fields.unit, ...units]).map((unit) => (
                            <option key={unit} value={unit}>
                                {unit}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor="item-supplier">Supplier</label>
                    <select id="item-supplier" className="input min-h-11 w-full" value={fields.supplier_id} onChange={set('supplier_id')}>
                        <option value="">No supplier</option>
                        {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
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
                    disabled={busy || !fields.name.trim() || !fields.sku.trim()}
                    onClick={() =>
                        onSave({
                            name: fields.name.trim(),
                            sku: fields.sku.trim(),
                            category: fields.category.trim(),
                            unit: fields.unit,
                            on_hand: number(fields.on_hand) ?? 0,
                            par: number(fields.par) ?? 0,
                            critical: number(fields.critical),
                            cost: number(fields.cost) ?? 0,
                            supplier_id: fields.supplier_id ? Number(fields.supplier_id) : null,
                            pack_name: fields.pack_name.trim() || null,
                            pack_size: number(fields.pack_size),
                        })
                    }
                    className="btn btn-primary flex-1 p-3 text-sm font-semibold disabled:opacity-50"
                >
                    {isNew ? 'Add item' : 'Save item'}
                </button>
            </div>
        </Sheet>
    );
}

function CategoriesSheet({
    open,
    categories,
    counts,
    busy,
    onClose,
    onRename,
}: {
    open: boolean;
    categories: string[];
    counts: Record<string, number>;
    busy: boolean;
    onClose: () => void;
    onRename: (from: string, to: string, done: () => void) => void;
}) {
    const [renaming, setRenaming] = useState<string | null>(null);
    const [name, setName] = useState('');

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Categories"
            description="Rename a category for this location. A new category starts when an item is given one."
            width="max-w-[440px]"
        >
            <div className="flex flex-col gap-2">
                {categories.map((category) => (
                    <div key={category} className="border-divider bg-bg rounded-btn flex items-center gap-2 border py-2 pr-2 pl-3">
                        {renaming === category ? (
                            <>
                                <input
                                    aria-label={`New name for ${category}`}
                                    className="input min-w-0 flex-1"
                                    value={name}
                                    autoFocus
                                    onChange={(event) => setName(event.target.value)}
                                />
                                <button
                                    type="button"
                                    disabled={busy || !name.trim() || name.trim() === category}
                                    onClick={() => onRename(category, name.trim(), () => setRenaming(null))}
                                    className="btn btn-primary px-3 py-[7px] text-xs font-semibold disabled:opacity-50"
                                >
                                    Save
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13.5px]">{category}</div>
                                    <div className="text-text/74 text-[11px]">
                                        {counts[category]} {counts[category] === 1 ? 'item' : 'items'}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRenaming(category);
                                        setName(category);
                                    }}
                                    className="border-divider bg-surface rounded-btn cursor-pointer border px-2.5 py-[5px] text-xs"
                                >
                                    Rename
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
            <button type="button" onClick={onClose} className="btn btn-primary mt-6 w-full p-3 text-sm font-semibold">
                Done
            </button>
        </Sheet>
    );
}
