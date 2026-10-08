<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\StockItem;
use App\Services\Production;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * PRODUCTS and RECIPES from the Inventory prototype: [sku, name, servings per batch, serving size,
     * serving unit, stock per batch, stock unit, recipe per batch by SKU].
     *
     * @var list<array{0: string, 1: string, 2: float, 3: string, 4: string, 5: float, 6: string, 7: array<string, float>}>
     */
    public const PRODUCTS = [
        ['WH-SEM-001', 'Cold brew concentrate', 40, '250', 'ml', 10, 'L', ['WH-COF-004' => 0.25, 'WH-COF-001' => 0.1]],
        ['WH-SEM-004', 'Ube cheese pandesal dough', 60, '80', 'g', 5, 'kg', ['WH-BAK-001' => 0.6, 'WH-BAK-006' => 0.08, 'WH-DRY-011' => 0.2]],
        ['WH-SEM-007', 'Croissant dough, laminated', 40, '120', 'g', 5, 'kg', ['WH-BAK-001' => 0.55, 'WH-BAK-006' => 0.3, 'WH-DRY-011' => 0.12]],
        ['WH-SEM-011', 'Caramel sauce, batch', 90, '30', 'ml', 3, 'L', ['WH-DRY-014' => 3, 'WH-BAK-006' => 0.15, 'WH-SYR-002' => 0.5]],
        ['WH-SEM-014', 'Whipped topping base', 100, '50', 'ml', 5, 'L', ['WH-DRY-011' => 0.6, 'WH-BAK-014' => 0.03]],
    ];

    /**
     * Seed the commissary's products and their recipes.
     */
    public function run(Production $production): void
    {
        $skus = StockItem::pluck('id', 'sku');

        foreach (self::PRODUCTS as [$sku, $name, $servings, $size, $servingUnit, $perBatch, $unit, $recipe]) {
            $item = StockItem::updateOrCreate(['sku' => $sku], ['name' => $name, 'category' => 'Semi-finished', 'unit' => $unit, 'cost' => 0, 'par' => 0]);
            $product = Product::updateOrCreate(['stock_item_id' => $item->id], [
                'servings_per_batch' => $servings,
                'serving_size' => $size,
                'serving_unit' => $servingUnit,
                'stock_per_batch' => $perBatch,
            ]);

            $production->saveRecipe($product, collect($recipe)->mapWithKeys(fn (float $qty, string $ingredient) => [$skus[$ingredient] => $qty])->all());
        }
    }
}
