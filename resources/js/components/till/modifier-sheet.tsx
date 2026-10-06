import { choiceClass, Sheet } from '@/components/till/sheet';
import { peso, type TillAddon, type TillChoice, type TillMenuItem } from '@/lib/till';
import { useState } from 'react';

interface ModifierSheetProps {
    item: TillMenuItem;
    sizes: TillChoice[];
    milks: TillChoice[];
    /** Add-ons switched on at this branch; the sheet shows only those this item offers. */
    addons: TillAddon[];
    orderOnly: boolean;
    onCancel: () => void;
    onAdd: (choice: { size: TillChoice; milk: TillChoice; addons: TillAddon[]; qty: number }) => void;
}

/**
 * Size, milk and add-ons for an item that asks for them, plus how many to add.
 */
export function ModifierSheet({ item, sizes, milks, addons, orderOnly, onCancel, onAdd }: ModifierSheetProps) {
    const [size, setSize] = useState(sizes[0]);
    const [milk, setMilk] = useState(milks[0]);
    const [picked, setPicked] = useState<TillAddon[]>([]);
    const [qty, setQty] = useState(1);

    const offered = addons.filter((addon) => item.addon_ids.includes(addon.id));
    const each = (item.price ?? 0) + (size.price ?? 0) + (milk.price ?? 0) + picked.reduce((sum, addon) => sum + (addon.price ?? 0), 0);
    const label = (choice: { price?: number }, name: string) => (!orderOnly && choice.price ? `${name} +${peso(choice.price)}` : name);

    const toggleAddon = (addon: TillAddon) =>
        setPicked((current) => (current.some((a) => a.id === addon.id) ? current.filter((a) => a.id !== addon.id) : [...current, addon]));

    return (
        <Sheet
            open
            onClose={onCancel}
            title={
                <span className="flex items-baseline justify-between gap-4">
                    <span>{item.name}</span>
                    {!orderOnly && <span className="text-accent-700 text-xl font-semibold tabular-nums">{peso(each)}</span>}
                </span>
            }
        >
            <div className="mt-[18px]">
                <ChoiceGroup label="Size">
                    {sizes.map((choice) => (
                        <button
                            key={choice.value}
                            type="button"
                            onClick={() => setSize(choice)}
                            className={choiceClass(size.value === choice.value) + ' px-[18px] py-[11px] text-sm'}
                        >
                            {label(choice, choice.label)}
                        </button>
                    ))}
                </ChoiceGroup>
                <ChoiceGroup label="Milk">
                    {milks.map((choice) => (
                        <button
                            key={choice.value}
                            type="button"
                            onClick={() => setMilk(choice)}
                            className={choiceClass(milk.value === choice.value) + ' px-[18px] py-[11px] text-sm'}
                        >
                            {label(choice, choice.label)}
                        </button>
                    ))}
                </ChoiceGroup>
                {offered.length > 0 && (
                    <ChoiceGroup label="Add-ons">
                        {offered.map((addon) => (
                            <button
                                key={addon.id}
                                type="button"
                                aria-pressed={picked.some((a) => a.id === addon.id)}
                                onClick={() => toggleAddon(addon)}
                                className={choiceClass(picked.some((a) => a.id === addon.id)) + ' px-[18px] py-[11px] text-sm'}
                            >
                                {label(addon, addon.name)}
                            </button>
                        ))}
                    </ChoiceGroup>
                )}
            </div>

            <div className="mt-[22px] mb-1 flex flex-wrap items-center gap-3.5">
                <div className="border-divider rounded-btn flex items-center gap-2.5 border p-1.5">
                    <button
                        type="button"
                        aria-label="One less"
                        onClick={() => setQty((current) => Math.max(1, current - 1))}
                        className="bg-surface size-9 cursor-pointer rounded-full text-lg"
                    >
                        −
                    </button>
                    <div className="min-w-5 text-center text-[17px] font-semibold tabular-nums">{qty}</div>
                    <button
                        type="button"
                        aria-label="One more"
                        onClick={() => setQty((current) => current + 1)}
                        className="bg-surface size-9 cursor-pointer rounded-full text-lg"
                    >
                        +
                    </button>
                </div>
                <button type="button" onClick={onCancel} className="btn btn-secondary px-[22px] py-[15px] font-semibold">
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => onAdd({ size, milk, addons: picked, qty })}
                    className="btn btn-primary flex-1 p-[15px] text-[15.5px] font-semibold whitespace-nowrap"
                >
                    {orderOnly ? 'Add to order' : `Add to order · ${peso(each * qty)}`}
                </button>
            </div>
        </Sheet>
    );
}

function ChoiceGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-[18px]">
            <div className="text-text/74 mb-[9px] text-[11.5px] tracking-[.08em] uppercase">{label}</div>
            <div className="flex flex-wrap gap-2">{children}</div>
        </div>
    );
}
