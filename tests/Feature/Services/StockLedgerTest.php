<?php

use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\StockCount;
use App\Models\StockCountLine;
use App\Models\StockItem;
use App\Models\StockReceipt;
use App\Services\StockLedger;

test('compares counted usage with what sales predict since the previous count', function () {
    $till = branchWithMenu();
    $croissants = StockItem::factory()->create(['cost' => 38]);
    $till['croissant']->ingredients()->attach($croissants->id, ['qty' => 1]);
    $previous = StockCount::factory()->for($till['branch'])->submitted()->create(['day' => '2026-10-05']);
    StockCountLine::factory()->for($previous)->for($croissants)->create(['counted' => 10]);
    StockReceipt::factory()->for($till['branch'])->for($croissants)->create(['day' => '2026-10-06', 'qty' => 5]);
    StockReceipt::factory()->for($till['branch'])->for($croissants)->create(['day' => '2026-10-05', 'qty' => 99]);
    $sale = Order::factory()->for($till['branch'])->create(['paid_at' => '2026-10-06 04:00:00']);
    OrderLine::factory()->for($sale)->create(['menu_item_id' => $till['croissant']->id, 'qty' => 6]);
    $sheet = StockCount::factory()->for($till['branch'])->submitted()->create(['day' => '2026-10-07']);
    StockCountLine::factory()->for($sheet)->for($croissants)->create(['counted' => 8]);

    $row = app(StockLedger::class)->dayRows($sheet)[0];

    expect($row)->toMatchArray([
        'beginning' => 10.0,
        'received' => 5.0,
        'ending' => 8.0,
        'used' => 7.0,
        'expected' => 6.0,
        'gap' => 1.0,
        'value' => 38.0,
        'off' => true,
    ]);
});

test('starts from on hand, skipping a sheet returned for re-count', function () {
    $branch = Branch::factory()->create();
    $milk = StockItem::factory()->create();
    BranchStock::factory()->for($branch)->for($milk)->create(['on_hand' => 20]);
    $returned = StockCount::factory()->for($branch)->create(['day' => '2026-10-06', 'status' => StockCountStatus::Returned]);
    StockCountLine::factory()->for($returned)->for($milk)->create(['counted' => 2]);
    $sheet = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07']);
    StockCountLine::factory()->for($sheet)->for($milk)->create(['counted' => 15]);

    $row = app(StockLedger::class)->dayRows($sheet)[0];

    expect($row)->toMatchArray(['beginning' => 20.0, 'used' => 5.0, 'expected' => null, 'gap' => null, 'off' => false]);
});
