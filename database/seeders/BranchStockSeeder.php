<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\StockItem;
use Illuminate\Database\Seeder;

class BranchStockSeeder extends Seeder
{
    /**
     * On hand from STOCK0 in the POS prototype, by SKU. Every café branch starts with the same counts.
     *
     * @var array<string, float>
     */
    public const ON_HAND = [
        'WH-COF-001' => 6.4, 'WH-COF-004' => 4, 'WH-DRY-011' => 9, 'WH-DRY-014' => 14, 'WH-DRY-018' => 4,
        'WH-DRY-024' => 620, 'WH-BAK-009' => 2.1, 'WH-SYR-002' => 2, 'WH-SYR-003' => 5, 'WH-PKG-021' => 320,
        'WH-PKG-022' => 180, 'WH-PKG-030' => 2, 'WH-BAK-001' => 12, 'WH-BAK-014' => 3, 'WH-BAK-006' => 1.2,
        'WH-KIT-020' => 18, 'WH-KIT-022' => 5.5, 'WH-KIT-024' => 7, 'WH-KIT-031' => 4, 'WH-KIT-040' => 9,
        'WH-PST-001' => 14, 'WH-PST-004' => 10, 'WH-PST-007' => 12, 'WH-PST-011' => 8, 'WH-DRY-002' => 12,
        'WH-BAK-003' => 25, 'WH-DRY-027' => 5, 'WH-CHL-002' => 4.2, 'WH-CHL-004' => 3.6, 'WH-CHL-010' => 20,
        'WH-PKG-035' => 9, 'WH-PKG-038' => 14,
    ];

    /**
     * Seed each café branch's on-hand stock.
     */
    public function run(): void
    {
        $stockIds = StockItem::pluck('id', 'sku');

        Branch::where('kind', BranchKind::Branch)->each(function (Branch $branch) use ($stockIds) {
            foreach (self::ON_HAND as $sku => $onHand) {
                $branch->stock()->updateOrCreate(['stock_item_id' => $stockIds[$sku]], ['on_hand' => $onHand]);
            }
        });
    }
}
