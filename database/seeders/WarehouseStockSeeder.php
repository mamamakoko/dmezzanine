<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\ShoppingListLine;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Models\WarehouseStock;
use Illuminate\Database\Seeder;

class WarehouseStockSeeder extends Seeder
{
    /**
     * The warehouse's stock from SEED_STOCK in the Inventory prototype, plus the items the POS prototype's
     * requisition list adds: [sku, on hand, low level, supplier, units per pack, pack name]. Cups and lids
     * are counted in pieces here (the prototype counted packs of 50).
     *
     * @var list<array{0: string, 1: float, 2: float, 3: string, 4: ?float, 5: ?string}>
     */
    public const STOCK = [
        ['WH-COF-001', 18, 24, 'Kalinga Highland Co.', null, null],
        ['WH-COF-004', 31, 20, 'Kalinga Highland Co.', null, null],
        ['WH-DRY-011', 26, 40, 'Iriga Dairy Supply', 6, 'case'],
        ['WH-DRY-014', 48, 30, 'Bicol Trading', 24, 'case'],
        ['WH-DRY-018', 14, 10, 'Iriga Dairy Supply', 12, 'case'],
        ['WH-DRY-024', 2400, 800, 'Bicol Trading', 500, 'bag'],
        ['WH-SYR-002', 4, 12, 'Sweetline PH', null, null],
        ['WH-SYR-003', 9, 12, 'Sweetline PH', null, null],
        ['WH-PKG-021', 600, 750, 'Naga Packaging', 50, 'pack'],
        ['WH-PKG-022', 1100, 750, 'Naga Packaging', 50, 'pack'],
        ['WH-PKG-030', 6, 10, 'Naga Packaging', null, null],
        ['WH-BAK-001', 44, 30, 'Bicol Trading', 25, 'sack'],
        ['WH-BAK-014', 9, 14, 'Bicol Trading', 2, 'sack'],
        ['WH-BAK-006', 7, 12, 'Iriga Dairy Supply', null, null],
        ['WH-BAK-009', 5, 6, 'Sweetline PH', 5, 'bag'],
        ['WH-KIT-020', 60, 40, 'Bicol Trading', 25, 'sack'],
        ['WH-KIT-022', 22, 15, 'Bicol Trading', null, null],
    ];

    /**
     * Seed the warehouse's stock, each item's supplier and packaging, and a shopping list of the items
     * below par, as the prototype opens with (the last two are left off, so they still read "Add to list").
     */
    public function run(): void
    {
        $warehouse = Branch::where('kind', BranchKind::Warehouse)->firstOrFail();
        $suppliers = Supplier::pluck('id', 'name');

        foreach (self::STOCK as [$sku, $onHand, $par, $supplier, $packSize, $packName]) {
            $item = StockItem::where('sku', $sku)->firstOrFail();
            $item->update(['supplier_id' => $suppliers[$supplier], 'pack_size' => $packSize, 'pack_name' => $packName]);
            WarehouseStock::updateOrCreate(['branch_id' => $warehouse->id, 'stock_item_id' => $item->id], ['on_hand' => $onHand, 'par' => $par]);
        }

        if (ShoppingListLine::exists()) {
            return;
        }

        $belowPar = $warehouse->warehouseStock()->with('stockItem')->get()
            ->filter(fn (WarehouseStock $held) => $held->isBelowPar())
            ->sortBy('stockItem.name')
            ->values();

        foreach ($belowPar->slice(0, max(0, $belowPar->count() - 2)) as $held) {
            ShoppingListLine::create([
                'branch_id' => $warehouse->id,
                'stock_item_id' => $held->stock_item_id,
                'name' => $held->stockItem->name,
                'unit' => $held->stockItem->unit,
                'cost' => $held->stockItem->cost,
                'qty' => max(1, ceil((float) $held->par - (float) $held->on_hand)),
                'reason' => 'Below par · '.(float) $held->on_hand.' of '.(float) $held->par.' '.$held->stockItem->unit,
            ]);
        }
    }
}
