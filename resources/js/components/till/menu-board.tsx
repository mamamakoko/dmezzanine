import { peso, type TillCategory, type TillMenuItem } from '@/lib/till';
import { cn } from '@/lib/utils';

interface MenuBoardProps {
    categories: TillCategory[];
    menu: TillMenuItem[];
    categoryId: number | null;
    onCategory: (id: number) => void;
    search: string;
    onSearch: (search: string) => void;
    /** How many of each item are on the pending order, by menu item id. */
    inOrder: Record<number, number>;
    orderOnly: boolean;
    onPick: (item: TillMenuItem) => void;
}

/**
 * Category tabs and search on top, menu tiles below. Searching looks across every category.
 */
export function MenuBoard({ categories, menu, categoryId, onCategory, search, onSearch, inOrder, orderOnly, onPick }: MenuBoardProps) {
    const query = search.trim().toLowerCase();
    const items = menu.filter((item) => (query ? item.name.toLowerCase().includes(query) : item.category_id === categoryId));

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-5 py-[18px]">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
                {categories.map((category) => {
                    const on = category.id === categoryId && !query;

                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => onCategory(category.id)}
                            className={cn(
                                'rounded-btn min-h-11 cursor-pointer border px-5 text-[14.5px] font-semibold',
                                on ? 'border-accent bg-accent text-bg' : 'border-divider text-text hover:border-accent-400 bg-transparent',
                            )}
                        >
                            {category.name === 'Frappe' ? 'Frappé' : category.name}
                        </button>
                    );
                })}
                <div className="flex-1" />
                <input
                    type="search"
                    aria-label="Search menu"
                    className="input w-[190px]"
                    placeholder="Search menu"
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                />
            </div>

            <div className="-mx-2.5 -mt-2.5 min-h-0 flex-1 overflow-auto px-2.5 pt-2.5 pb-2">
                {items.length === 0 ? (
                    <p className="text-text/74 mt-10 text-center text-sm">
                        {query ? `Nothing on the menu matches “${search.trim()}”.` : 'No items in this category.'}
                    </p>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-3.5">
                        {items.map((item) => (
                            <MenuTile key={item.id} item={item} qty={inOrder[item.id] ?? 0} orderOnly={orderOnly} onPick={() => onPick(item)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function MenuTile({ item, qty, orderOnly, onPick }: { item: TillMenuItem; qty: number; orderOnly: boolean; onPick: () => void }) {
    return (
        <button
            type="button"
            onClick={onPick}
            className="border-divider hover:border-accent-400 relative cursor-pointer overflow-hidden rounded-md border bg-neutral-100 p-0 text-left shadow-[var(--shadow-sm)]"
        >
            <div
                className="bg-surface flex h-[104px] items-end bg-cover bg-center p-2"
                style={item.photo_url ? { backgroundImage: `url("${item.photo_url}")` } : undefined}
            >
                {!item.photo_url && (
                    <span className="text-text/74 rounded-btn bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px]">add photo in Menu</span>
                )}
            </div>
            <div className="px-3.5 pt-3 pb-3.5">
                <div className="text-base leading-[1.15] font-semibold">{item.name}</div>
                {orderOnly ? (
                    item.note && <div className="text-text/74 mt-1.5 text-[11.5px]">{item.note}</div>
                ) : (
                    <div className="text-accent-700 mt-1.5 text-base font-semibold tabular-nums">{peso(item.price ?? 0)}</div>
                )}
            </div>
            {qty > 0 && (
                <div
                    aria-label={`${qty} on the order`}
                    className="bg-accent text-bg absolute top-2 right-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-[7px] text-[13px] font-semibold tabular-nums"
                >
                    {qty}
                </div>
            )}
        </button>
    );
}
