<?php

namespace Database\Seeders;

use App\Models\StockItem;
use Illuminate\Database\Seeder;

class StockItemSeeder extends Seeder
{
    /**
     * The 32 warehouse SKUs from STOCK0 in the Branch Menu prototype: [sku, name, category, unit, cost, par].
     *
     * @var list<array{0: string, 1: string, 2: string, 3: string, 4: float, 5: float}>
     */
    public const ITEMS = [
        ['WH-COF-001', 'Arabica beans, house blend', 'Coffee', 'kg', 620, 8],
        ['WH-COF-004', 'Robusta beans', 'Coffee', 'kg', 480, 6],
        ['WH-DRY-011', 'Fresh milk', 'Dairy', 'L', 92, 24],
        ['WH-DRY-014', 'Condensed milk', 'Dairy', 'can', 68, 18],
        ['WH-DRY-018', 'Oat milk', 'Dairy', 'L', 165, 10],
        ['WH-DRY-024', 'Matcha powder', 'Dry goods', 'g', 4.2, 800],
        ['WH-BAK-009', 'Cocoa powder', 'Baking', 'kg', 520, 3],
        ['WH-SYR-002', 'Caramel syrup', 'Syrup', 'btl', 240, 6],
        ['WH-SYR-003', 'Vanilla syrup', 'Syrup', 'btl', 240, 6],
        ['WH-PKG-021', 'Paper cups, 16oz', 'Packaging', 'pc', 6.5, 500],
        ['WH-PKG-022', 'Dome lids, 16oz', 'Packaging', 'pc', 3.2, 500],
        ['WH-PKG-030', 'Kraft carrier bags', 'Packaging', 'pack', 145, 5],
        ['WH-BAK-001', 'All-purpose flour', 'Baking', 'kg', 62, 15],
        ['WH-BAK-014', 'Cornstarch', 'Baking', 'kg', 58, 5],
        ['WH-BAK-006', 'Butter, unsalted', 'Baking', 'kg', 410, 4],
        ['WH-KIT-020', 'Jasmine rice', 'Kitchen', 'kg', 62, 20],
        ['WH-KIT-022', 'Pork belly', 'Kitchen', 'kg', 380, 8],
        ['WH-KIT-024', 'Chicken thigh', 'Kitchen', 'kg', 210, 9],
        ['WH-KIT-031', 'Eggs', 'Kitchen', 'tray', 245, 6],
        ['WH-KIT-040', 'Cooking oil', 'Kitchen', 'L', 135, 12],
        ['WH-PST-001', 'Butter croissant', 'Pastry', 'pc', 38, 20],
        ['WH-PST-004', 'Cinnamon roll', 'Pastry', 'pc', 42, 14],
        ['WH-PST-007', 'Banana bread', 'Pastry', 'slice', 30, 16],
        ['WH-PST-011', 'Ube cheese pandesal', 'Pastry', 'pack', 75, 10],
        ['WH-DRY-002', 'Refined sugar', 'Dry goods', 'kg', 78, 15],
        ['WH-BAK-003', 'Bread flour', 'Baking', 'kg', 55, 30],
        ['WH-DRY-027', 'Whipping cream', 'Dairy', 'L', 320, 8],
        ['WH-CHL-002', 'Beef tapa, marinated', 'Chilled', 'kg', 380, 6],
        ['WH-CHL-004', 'Tocino, marinated', 'Chilled', 'kg', 340, 5],
        ['WH-CHL-010', 'Ice', 'Chilled', 'kg', 12, 30],
        ['WH-PKG-035', 'Paper straws', 'Packaging', 'pack', 120, 12],
        ['WH-PKG-038', 'Napkins', 'Packaging', 'pack', 85, 18],
    ];

    /**
     * Seed the stock items.
     */
    public function run(): void
    {
        foreach (self::ITEMS as [$sku, $name, $category, $unit, $cost, $par]) {
            StockItem::updateOrCreate(
                ['sku' => $sku],
                ['name' => $name, 'category' => $category, 'unit' => $unit, 'cost' => $cost, 'par' => $par],
            );
        }
    }
}
