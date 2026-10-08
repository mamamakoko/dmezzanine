<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\User;
use App\Services\Transfers;
use Illuminate\Database\Seeder;

class TransferSeeder extends Seeder
{
    /**
     * Two open transfers like the prototypes': the commissary's new request to the warehouse, and a
     * requisition on its way from the warehouse to DMC-Iriga. Seeded once.
     */
    public function run(Transfers $transfers): void
    {
        if (Transfer::exists()) {
            return;
        }

        $warehouse = Branch::where('kind', BranchKind::Warehouse)->firstOrFail();
        $commissary = Branch::where('kind', BranchKind::Commissary)->firstOrFail();
        $iriga = Branch::where('name', 'DMC-Iriga Branch')->firstOrFail();
        $sku = StockItem::pluck('id', 'sku');

        $transfers->requisition($warehouse, $commissary, [$sku['WH-COF-001'] => 6, $sku['WH-DRY-011'] => 12, $sku['WH-SYR-002'] => 2], User::firstWhere('email', 'deng@dmezzanine.ph'));

        $toIriga = $transfers->requisition($warehouse, $iriga, [$sku['WH-COF-001'] => 3, $sku['WH-DRY-011'] => 6], User::firstWhere('email', 'joy@dmezzanine.ph'));
        $marisol = User::firstWhere('email', 'marisol@dmezzanine.ph');
        $transfers->approve($toIriga, $marisol);
        $transfers->issue($toIriga, $marisol);
    }
}
