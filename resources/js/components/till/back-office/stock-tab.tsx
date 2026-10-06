import { qtyLabel, stockStatus, type StockRow, type TabData } from '@/lib/back-office';
import { peso } from '@/lib/till';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const rank = (row: StockRow) => (row.on_hand <= 0 ? 0 : row.low ? 1 : row.on_hand < row.par ? 2 : 3);

/**
 * On hand at this branch (from the last approved count) against par, with search, category chips and sort.
 */
export function StockTab({ data }: { data: TabData<'stock'> }) {
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');
    const [sort, setSort] = useState<'name' | 'status'>('name');

    const categories = ['All', ...new Set(data.stock.map((row) => row.category))];
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = data.stock
        .filter((row) => category === 'All' || row.category === category)
        .filter((row) => terms.every((term) => `${row.name} ${row.sku} ${row.category}`.toLowerCase().includes(term)))
        .sort((a, b) => (sort === 'status' ? rank(a) - rank(b) : 0) || a.name.localeCompare(b.name));

    const chip = (on: boolean) =>
        cn(
            'rounded-btn min-h-11 cursor-pointer border px-[17px] text-[13.5px] font-semibold',
            on ? 'border-accent bg-accent text-bg' : 'border-divider text-text bg-transparent',
        );

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
                <input
                    className="input min-h-11 min-w-0 flex-[1_1_240px]"
                    placeholder="Search item or SKU"
                    aria-label="Search stock"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                    <button type="button" onClick={() => setQuery('')} className={chip(false)}>
                        Clear
                    </button>
                )}
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
                {categories.map((name) => (
                    <button key={name} type="button" onClick={() => setCategory(name)} className={chip(category === name)}>
                        {name}
                    </button>
                ))}
                <div className="flex-1" />
                <div className="text-text/74 text-[12.5px]">
                    {rows.length} of {data.stock.length} items
                </div>
                <div className="text-text/74 text-[11.5px] tracking-[.08em] uppercase">Sort</div>
                <button type="button" onClick={() => setSort('name')} className={chip(sort === 'name')}>
                    Name
                </button>
                <button type="button" onClick={() => setSort('status')} className={chip(sort === 'status')}>
                    Status
                </button>
            </div>

            <div className="min-w-0 overflow-x-auto">
                <table className="table w-full">
                    <thead>
                        <tr>
                            <th className="text-left">SKU</th>
                            <th className="text-left">Item</th>
                            <th className="text-left">Category</th>
                            <th className="text-right">On hand</th>
                            <th className="text-right">Par</th>
                            <th className="text-right">Unit cost</th>
                            <th className="text-right">Value</th>
                            <th className="text-left">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const status = stockStatus(row);

                            return (
                                <tr key={row.id}>
                                    <td className="text-text/74 text-[12.5px] tracking-[.04em] whitespace-nowrap">{row.sku}</td>
                                    <td className="text-[14.5px] font-semibold">{row.name}</td>
                                    <td className="text-text/74">{row.category}</td>
                                    <td
                                        className="text-right whitespace-nowrap tabular-nums"
                                        title={row.counted_on ? `Counted ${row.counted_on}` : 'Not counted yet'}
                                    >
                                        {qtyLabel(row.on_hand, row.unit)}
                                    </td>
                                    <td className="text-text/74 text-right tabular-nums">{qtyLabel(row.par, row.unit)}</td>
                                    <td className="text-text/74 text-right tabular-nums">{peso(row.cost)}</td>
                                    <td className="text-right tabular-nums">{peso(row.cost * row.on_hand)}</td>
                                    <td>
                                        <span
                                            className={cn(
                                                'tag rounded-btn font-semibold whitespace-nowrap',
                                                status.tone === 'accent' ? 'tag-accent' : status.tone === 'outline' ? 'tag-outline' : 'tag-accent-2',
                                            )}
                                        >
                                            {status.label}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {rows.length === 0 && <div className="text-text/74 px-2 py-[34px] text-center text-sm">Nothing matches that search.</div>}
        </div>
    );
}
