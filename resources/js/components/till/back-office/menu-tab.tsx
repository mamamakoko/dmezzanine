import { PartsEditor, RemoveButton, SectionLabel, useBackOfficeAction } from '@/components/till/back-office/ui';
import { ConfirmDialog, Sheet } from '@/components/till/sheet';
import { cropMenuPhoto, PHOTO_HEIGHT, PHOTO_WIDTH, type MenuCategory, type MenuRow, type Part, type TabData } from '@/lib/back-office';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Toast = (message: string) => void;

const categoryLabel = (name: string) => (name === 'Frappe' ? 'Frappé' : name);

/**
 * This branch's menu: its categories, and each item's photo, price, availability and recipe. Prices,
 * photos and recipes are shared by every branch, so only the Owner edits them; the branch lead decides
 * what is on the board here and in which category.
 */
export function MenuTab({ data, toast }: { data: TabData<'menu'>; toast: Toast }) {
    const { send, processing } = useBackOfficeAction(toast);
    const [query, setQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [availability, setAvailability] = useState<'All' | 'Live' | 'Off'>('All');
    const [editing, setEditing] = useState<MenuRow | 'new' | null>(null);
    const [adding, setAdding] = useState(false);
    const [naming, setNaming] = useState<MenuCategory | 'new' | null>(null);
    const [removing, setRemoving] = useState<MenuRow | null>(null);

    const categoryName = (id: number) => data.categories.find((category) => category.id === id)?.name ?? '';
    const terms = query.trim().toLowerCase();
    const rows = data.items.filter(
        (item) =>
            (!terms || `${item.name} ${categoryName(item.category_id)} ${item.note ?? ''}`.toLowerCase().includes(terms)) &&
            (categoryFilter === 'All' || String(item.category_id) === categoryFilter) &&
            (availability === 'All' || (availability === 'Live') === item.available),
    );

    const uploadPhoto = (item: MenuRow, file: File | undefined) => {
        if (!file) {
            return;
        }

        cropMenuPhoto(file)
            .then((photo) =>
                send(
                    'post',
                    route('pos.menu-items.photo.store', item.id),
                    { photo },
                    { forceFormData: true, success: `${item.name} photo set · ${PHOTO_WIDTH}×${PHOTO_HEIGHT}` },
                ),
            )
            .catch((error: Error) => toast(error.message));
    };

    return (
        <div>
            <div className="border-divider mb-5 rounded-md border bg-neutral-100 px-[18px] py-4">
                <SectionLabel className="mb-[11px]">Categories</SectionLabel>
                <div className="flex flex-wrap gap-[9px]">
                    {data.categories.map((category) => (
                        <div
                            key={category.id}
                            className="border-divider bg-surface rounded-btn flex items-center gap-[9px] border py-[7px] pr-2 pl-4"
                        >
                            <div>
                                <div className="text-sm leading-[1.15] font-semibold">{categoryLabel(category.name)}</div>
                                <div className="text-text/74 text-[11px]">
                                    {category.count} {category.count === 1 ? 'item' : 'items'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNaming(category)}
                                className="border-divider rounded-btn hover:border-accent min-h-10 cursor-pointer border bg-neutral-100 px-4 text-[13px] font-semibold"
                            >
                                Rename
                            </button>
                            <RemoveButton
                                label={`Remove ${category.name}`}
                                onClick={() =>
                                    send('delete', route('pos.categories.destroy', category.id), {}, { success: `${category.name} category removed` })
                                }
                            />
                        </div>
                    ))}
                    <button type="button" onClick={() => setNaming('new')} className="btn btn-secondary px-5 py-[11px] text-[13.5px] font-semibold">
                        + New category
                    </button>
                </div>
            </div>

            <div className="mb-[18px] flex flex-wrap items-center gap-3">
                <input
                    className="input w-[250px]"
                    placeholder="Search menu items"
                    aria-label="Search menu items"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <select className="input" aria-label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                    <option value="All">All categories</option>
                    {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {categoryLabel(category.name)}
                        </option>
                    ))}
                </select>
                <select
                    className="input"
                    aria-label="Availability"
                    value={availability}
                    onChange={(event) => setAvailability(event.target.value as typeof availability)}
                >
                    <option value="All">All items</option>
                    <option value="Live">Live only</option>
                    <option value="Off">Off menu only</option>
                </select>
                <div className="text-text/74 text-[13.5px]">
                    {rows.length} {rows.length === 1 ? 'item' : 'items'}
                </div>
                <div className="flex-1" />
                {data.otherItems.length > 0 && (
                    <button type="button" onClick={() => setAdding(true)} className="btn btn-secondary px-5 py-3 font-semibold">
                        Add from shared menu
                    </button>
                )}
                {data.isOwner && (
                    <button type="button" onClick={() => setEditing('new')} className="btn btn-primary px-[22px] py-3 font-semibold">
                        Add menu item
                    </button>
                )}
            </div>

            {rows.length === 0 && (
                <div className="border-divider text-text/74 rounded-md border bg-neutral-100 p-[34px] text-center text-[13.5px]">
                    No menu items match your search.
                </div>
            )}

            <div className="flex flex-col gap-2">
                {rows.map((item) => (
                    <div
                        key={item.entry_id}
                        className={cn(
                            'border-divider flex flex-wrap items-center gap-4 rounded-md border bg-neutral-100 px-[18px] py-3.5',
                            !item.available && 'opacity-50',
                        )}
                    >
                        <div className="min-w-0 flex-1">
                            <div className="text-base font-semibold">{item.name}</div>
                            <div className="text-text/74 text-[12.5px]">
                                {[categoryLabel(categoryName(item.category_id)), item.note].filter(Boolean).join(' · ')}
                            </div>
                        </div>
                        <label
                            title={
                                data.isOwner
                                    ? `${item.photo_url ? 'Replace photo' : 'Add a photo for the tile layout'} · ${PHOTO_WIDTH}×${PHOTO_HEIGHT} minimum, cropped to 16:9`
                                    : undefined
                            }
                            className={cn(
                                'border-divider bg-surface text-text/74 flex size-14 flex-none items-center justify-center overflow-hidden rounded-[8px] border border-dashed bg-cover bg-center text-center text-[10px] leading-[1.25]',
                                data.isOwner && 'hover:border-accent hover:text-accent-700 cursor-pointer',
                            )}
                            style={item.photo_url ? { backgroundImage: `url("${item.photo_url}")` } : undefined}
                        >
                            {!item.photo_url && (data.isOwner ? 'Add photo 800×450' : 'No photo')}
                            {data.isOwner && (
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="sr-only"
                                    aria-label={`Photo for ${item.name}`}
                                    onChange={(event) => {
                                        uploadPhoto(item, event.target.files?.[0]);
                                        event.target.value = '';
                                    }}
                                />
                            )}
                        </label>
                        {data.isOwner && item.photo_url && (
                            <button
                                type="button"
                                title="Remove photo"
                                aria-label={`Remove ${item.name}'s photo`}
                                onClick={() =>
                                    send('delete', route('pos.menu-items.photo.destroy', item.id), {}, { success: `${item.name} photo removed` })
                                }
                                className="border-divider hover:border-accent hover:text-accent-700 size-[34px] cursor-pointer rounded-full border bg-transparent text-[13px]"
                            >
                                ⌫
                            </button>
                        )}
                        <div className="min-w-20 text-right text-[17px] font-semibold tabular-nums">{peso(item.price)}</div>
                        <button
                            type="button"
                            disabled={processing}
                            onClick={() =>
                                send(
                                    'patch',
                                    route('pos.menu.update', item.entry_id),
                                    { available: !item.available },
                                    { success: `${item.name} ${item.available ? 'hidden from' : 'back on'} the board` },
                                )
                            }
                            className={cn(
                                'border-divider rounded-btn min-h-10 min-w-28 cursor-pointer border px-4 text-[13px] font-semibold',
                                item.available ? 'bg-accent-2-200' : 'bg-neutral-200',
                            )}
                        >
                            {item.available ? 'On the board' : 'Hidden'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(item)}
                            className="btn btn-secondary min-h-10 px-5 text-[13.5px] font-semibold"
                        >
                            Edit
                        </button>
                        <RemoveButton label={`Take ${item.name} off this menu`} onClick={() => setRemoving(item)} />
                    </div>
                ))}
            </div>

            {editing && (
                <MenuItemSheet
                    item={editing === 'new' ? null : editing}
                    data={data}
                    processing={processing}
                    onClose={() => setEditing(null)}
                    onSave={(payload) => {
                        const done = { success: `${payload.name} saved`, onSuccess: () => setEditing(null) };

                        if (editing === 'new') {
                            send('post', route('pos.menu-items.store'), payload, done);
                        } else if (data.isOwner) {
                            send('put', route('pos.menu-items.update', editing.id), payload, done);
                        } else {
                            send('patch', route('pos.menu.update', editing.entry_id), { category_id: payload.category_id }, done);
                        }
                    }}
                />
            )}

            {adding && (
                <AddSharedItemSheet
                    data={data}
                    processing={processing}
                    onClose={() => setAdding(false)}
                    onAdd={(payload) =>
                        send('post', route('pos.menu.store'), payload, { success: 'Added to this menu', onSuccess: () => setAdding(false) })
                    }
                />
            )}

            {naming && (
                <CategorySheet
                    category={naming === 'new' ? null : naming}
                    processing={processing}
                    onClose={() => setNaming(null)}
                    onSave={(name) =>
                        naming === 'new'
                            ? send('post', route('pos.categories.store'), { name }, { success: `${name} added`, onSuccess: () => setNaming(null) })
                            : send(
                                  'patch',
                                  route('pos.categories.update', naming.id),
                                  { name },
                                  { success: `Renamed to ${name}`, onSuccess: () => setNaming(null) },
                              )
                    }
                />
            )}

            <ConfirmDialog
                open={removing !== null}
                title={`Take ${removing?.name} off this menu?`}
                body="It comes off this branch's till. Other branches and past sales keep it, and you can add it back from the shared menu."
                cancelLabel="Keep it"
                confirmLabel="Take it off"
                onCancel={() => setRemoving(null)}
                onConfirm={() => {
                    if (removing) {
                        send('delete', route('pos.menu.destroy', removing.entry_id), {}, { success: `${removing.name} removed from the menu` });
                    }

                    setRemoving(null);
                }}
            />
        </div>
    );
}

interface ItemPayload {
    name: string;
    price: string;
    note: string;
    has_modifiers: boolean;
    category_id: number | null;
    recipe: Part[];
    addon_ids: number[];
    [key: string]: unknown;
}

function MenuItemSheet({
    item,
    data,
    processing,
    onClose,
    onSave,
}: {
    item: MenuRow | null;
    data: TabData<'menu'>;
    processing: boolean;
    onClose: () => void;
    onSave: (payload: ItemPayload) => void;
}) {
    const [form, setForm] = useState<ItemPayload>({
        name: item?.name ?? '',
        price: item ? String(item.price) : '',
        note: item?.note ?? '',
        has_modifiers: item?.has_modifiers ?? false,
        category_id: item?.category_id ?? data.categories[0]?.id ?? null,
        recipe: item?.recipe ?? [],
        addon_ids: item?.addon_ids ?? [],
    });
    const set = (patch: Partial<ItemPayload>) => setForm((current) => ({ ...current, ...patch }));
    const shared = data.isOwner;
    const chip = (on: boolean, dark = false) =>
        cn(
            'rounded-btn min-h-10 cursor-pointer border px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed',
            on
                ? dark
                    ? 'border-neutral-900 bg-neutral-900 text-neutral-100'
                    : 'border-accent bg-accent text-bg'
                : 'border-divider text-text bg-transparent',
        );

    return (
        <Sheet
            open
            onClose={onClose}
            title={item ? `Edit ${item.name}` : 'New menu item'}
            description={
                shared
                    ? 'Changes show on every branch’s till right away.'
                    : 'Price, photo, recipe and add-ons are set by the Owner for every branch. You can change the category here.'
            }
        >
            <div className="mb-5 flex flex-col gap-3.5">
                <div className="field">
                    <label htmlFor="me-name">Item name</label>
                    <input
                        id="me-name"
                        className="input w-full"
                        disabled={!shared}
                        maxLength={60}
                        placeholder="Spanish Latte"
                        value={form.name}
                        onChange={(event) => set({ name: event.target.value })}
                    />
                </div>
                <div className="flex gap-3.5">
                    <div className="field w-[150px]">
                        <label htmlFor="me-price">Price</label>
                        <input
                            id="me-price"
                            className="input w-full tabular-nums"
                            disabled={!shared}
                            inputMode="decimal"
                            value={form.price}
                            onChange={(event) => set({ price: event.target.value.replace(/[^0-9.]/g, '') })}
                        />
                    </div>
                    <div className="field flex-1">
                        <label htmlFor="me-note">Description</label>
                        <input
                            id="me-note"
                            className="input w-full"
                            disabled={!shared}
                            maxLength={120}
                            placeholder="Condensed milk"
                            value={form.note}
                            onChange={(event) => set({ note: event.target.value })}
                        />
                    </div>
                </div>
                <div>
                    <SectionLabel>Category</SectionLabel>
                    <div className="flex flex-wrap gap-2">
                        {data.categories.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => set({ category_id: category.id })}
                                className={chip(form.category_id === category.id)}
                            >
                                {categoryLabel(category.name)}
                            </button>
                        ))}
                    </div>
                </div>
                <PartsEditor
                    parts={form.recipe}
                    stockItems={data.stockItems}
                    onChange={(recipe) => set({ recipe })}
                    disabled={!shared}
                    emptyText="Nothing deducted from stock yet. Add what one serving uses."
                />
                <label className={cn('flex items-center gap-2.5 text-sm', shared && 'cursor-pointer')}>
                    <input
                        type="checkbox"
                        disabled={!shared}
                        checked={form.has_modifiers}
                        onChange={() => set({ has_modifiers: !form.has_modifiers })}
                        className="accent-accent size-[22px]"
                    />
                    <span>Ask for size, milk and add-ons when ordered</span>
                </label>
                {form.has_modifiers && (
                    <div>
                        <SectionLabel>Add-ons offered</SectionLabel>
                        <div className="mb-2 flex flex-wrap gap-2">
                            {data.addons.map((addon) => {
                                const on = form.addon_ids.includes(addon.id);

                                return (
                                    <button
                                        key={addon.id}
                                        type="button"
                                        disabled={!shared}
                                        aria-pressed={on}
                                        onClick={() =>
                                            set({ addon_ids: on ? form.addon_ids.filter((id) => id !== addon.id) : [...form.addon_ids, addon.id] })
                                        }
                                        className={chip(on, true) + ' tabular-nums'}
                                    >
                                        {addon.name}
                                        {addon.price ? ` +${peso(addon.price)}` : ''}
                                    </button>
                                );
                            })}
                        </div>
                        {data.addons.length === 0 && <p className="text-text/74 mt-0 mb-1.5 text-[13px]">No add-ons set up yet.</p>}
                        <div className="text-text/74 text-xs">
                            {shared
                                ? 'Tap to offer or remove. Branches can still switch an add-on off.'
                                : 'Only the Owner can change which add-ons this item offers.'}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary px-[22px] py-[13px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={() => onSave(form)}
                    className="btn btn-primary px-[26px] py-[13px] font-semibold disabled:opacity-60"
                >
                    Save item
                </button>
            </div>
        </Sheet>
    );
}

function AddSharedItemSheet({
    data,
    processing,
    onClose,
    onAdd,
}: {
    data: TabData<'menu'>;
    processing: boolean;
    onClose: () => void;
    onAdd: (payload: { menu_item_id: number; category_id: number }) => void;
}) {
    const [itemId, setItemId] = useState(data.otherItems[0]?.id);
    const [categoryId, setCategoryId] = useState(data.categories[0]?.id);

    return (
        <Sheet
            open
            onClose={onClose}
            title="Add from the shared menu"
            description="Items other branches sell. It goes on this branch's board in the category you pick."
            width="max-w-[440px]"
        >
            <div className="field mb-3.5">
                <label htmlFor="shared-item">Item</label>
                <select id="shared-item" className="input w-full" value={itemId} onChange={(event) => setItemId(Number(event.target.value))}>
                    {data.otherItems.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))}
                </select>
            </div>
            <div className="field mb-5">
                <label htmlFor="shared-category">Category</label>
                <select
                    id="shared-category"
                    className="input w-full"
                    value={categoryId}
                    onChange={(event) => setCategoryId(Number(event.target.value))}
                >
                    {data.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {categoryLabel(category.name)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary px-[22px] py-[13px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={processing || !itemId || !categoryId}
                    onClick={() => itemId && categoryId && onAdd({ menu_item_id: itemId, category_id: categoryId })}
                    className="btn btn-primary px-[26px] py-[13px] font-semibold disabled:opacity-60"
                >
                    Add to menu
                </button>
            </div>
        </Sheet>
    );
}

function CategorySheet({
    category,
    processing,
    onClose,
    onSave,
}: {
    category: MenuCategory | null;
    processing: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
}) {
    const [name, setName] = useState(category?.name ?? '');

    return (
        <Sheet
            open
            onClose={onClose}
            title={category ? `Rename ${categoryLabel(category.name)}` : 'New category'}
            description="Categories are this branch's own till tabs."
            width="max-w-[400px]"
        >
            <div className="field mb-5">
                <label htmlFor="cat-name">Name</label>
                <input
                    id="cat-name"
                    className="input w-full"
                    maxLength={40}
                    placeholder="Smoothies"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
            </div>
            <div className="flex justify-end gap-2.5">
                <button type="button" onClick={onClose} className="btn btn-secondary px-[22px] py-[13px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={() => onSave(name.trim())}
                    className="btn btn-primary px-[26px] py-[13px] font-semibold disabled:opacity-60"
                >
                    Save
                </button>
            </div>
        </Sheet>
    );
}
