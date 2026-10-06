<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Enums\Station;
use App\Models\Branch;
use App\Models\StockItem;
use Illuminate\Database\Seeder;

class BranchStockItemSeeder extends Seeder
{
    /**
     * ITEMS from the Stock Count prototype: the SKUs a branch counts, by station.
     *
     * @var array<string, Station>
     */
    public const ROSTER = [
        'WH-COF-001' => Station::Bar, 'WH-DRY-011' => Station::Bar, 'WH-DRY-018' => Station::Bar,
        'WH-DRY-024' => Station::Bar, 'WH-SYR-002' => Station::Bar, 'WH-SYR-003' => Station::Bar,
        'WH-KIT-020' => Station::Kitchen, 'WH-KIT-022' => Station::Kitchen, 'WH-KIT-024' => Station::Kitchen,
        'WH-KIT-031' => Station::Kitchen, 'WH-KIT-040' => Station::Kitchen,
        'WH-PST-001' => Station::Pastry, 'WH-PST-004' => Station::Pastry, 'WH-PST-007' => Station::Pastry,
        'WH-PST-011' => Station::Pastry,
        'WH-DRY-002' => Station::DryStore, 'WH-BAK-003' => Station::DryStore, 'WH-BAK-009' => Station::DryStore,
        'WH-DRY-014' => Station::DryStore,
        'WH-DRY-027' => Station::Chiller, 'WH-CHL-002' => Station::Chiller, 'WH-CHL-004' => Station::Chiller,
        'WH-CHL-010' => Station::Chiller,
        'WH-PKG-021' => Station::Packaging, 'WH-PKG-022' => Station::Packaging, 'WH-PKG-030' => Station::Packaging,
        'WH-PKG-035' => Station::Packaging, 'WH-PKG-038' => Station::Packaging,
    ];

    /**
     * ROSTER_EXCLUDE from the prototype: Naga has no oat milk and doesn't bake in-house.
     *
     * @var array<string, list<string>>
     */
    public const NOT_CARRIED = [
        'DMC-Naga Branch' => ['WH-DRY-018', 'WH-BAK-003'],
    ];

    /**
     * Seed each café branch's count roster.
     */
    public function run(): void
    {
        $stockIds = StockItem::pluck('id', 'sku');

        Branch::where('kind', BranchKind::Branch)->each(function (Branch $branch) use ($stockIds) {
            foreach (self::ROSTER as $sku => $station) {
                if (in_array($sku, self::NOT_CARRIED[$branch->name] ?? [], true)) {
                    continue;
                }

                $branch->stockItems()->updateOrCreate(['stock_item_id' => $stockIds[$sku]], ['station' => $station]);
            }
        });
    }
}
