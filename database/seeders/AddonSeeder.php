<?php

namespace Database\Seeders;

use App\Models\Addon;
use App\Models\MenuItem;
use App\Models\StockItem;
use Illuminate\Database\Seeder;

class AddonSeeder extends Seeder
{
    /**
     * ADDONS and ADDON_PARTS0 from the Branch Menu prototype: name => [price, [stock SKU => quantity per serving]].
     *
     * @var array<string, array{0: int, 1: array<string, float>}>
     */
    public const ADDONS = [
        'Extra shot' => [35, ['WH-COF-001' => 0.014]],
        'Vanilla' => [20, ['WH-SYR-003' => 0.03]],
        'Whipped cream' => [25, []],
        'Decaf' => [0, []],
    ];

    /**
     * Seed the add-ons. As in the prototype, every item that asks for size/milk/add-ons offers all of them.
     */
    public function run(): void
    {
        $stockIds = StockItem::pluck('id', 'sku');
        $menuItemIds = MenuItem::where('has_modifiers', true)->pluck('id');

        foreach (self::ADDONS as $name => [$price, $parts]) {
            $addon = Addon::updateOrCreate(['name' => $name], ['price' => $price]);

            $addon->menuItems()->sync($menuItemIds);
            $addon->parts()->sync(
                collect($parts)
                    ->mapWithKeys(fn (float $qty, string $sku) => [$stockIds[$sku] => ['qty' => $qty]])
                    ->all(),
            );
        }
    }
}
