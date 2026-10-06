<?php

use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\StockItem;
use App\Services\UsageService;
use Illuminate\Support\Carbon;

/**
 * Sell a line on an order paid at the given UTC time.
 *
 * @param  array<string, mixed>  $order
 * @param  array<string, mixed>  $line
 */
function soldLine(Branch $branch, MenuItem $item, array $line = [], array $order = []): OrderLine
{
    $sale = Order::factory()->for($branch)->create(['paid_at' => '2026-10-07 02:00:00', ...$order]);

    return OrderLine::factory()->for($sale)->create(['menu_item_id' => $item->id, 'name' => $item->name, 'qty' => 1, ...$line]);
}

test('adds up recipes, milk choices and add-ons from the day\'s paid orders', function () {
    $till = branchWithMenu();
    $beans = StockItem::factory()->create(['sku' => 'WH-COF-001']);
    $freshMilk = StockItem::factory()->create(['sku' => UsageService::FRESH_MILK_SKU]);
    $oatMilk = StockItem::factory()->create(['sku' => UsageService::OAT_MILK_SKU]);
    $croissants = StockItem::factory()->create(['sku' => 'WH-PST-001']);
    $till['latte']->ingredients()->attach([$beans->id => ['qty' => 0.018], $freshMilk->id => ['qty' => 0.22]]);
    $till['croissant']->ingredients()->attach($croissants->id, ['qty' => 1]);
    $till['extraShot']->parts()->attach($beans->id, ['qty' => 0.014]);

    $twoWithExtraShot = soldLine($till['branch'], $till['latte'], ['qty' => 2, 'milk' => 'fresh']);
    $twoWithExtraShot->addons()->create(['addon_id' => $till['extraShot']->id, 'name' => 'Extra shot', 'price' => 35]);
    soldLine($till['branch'], $till['latte'], ['milk' => 'oat']);
    soldLine($till['branch'], $till['latte'], ['milk' => 'none']);
    soldLine($till['branch'], $till['croissant'], ['qty' => 3]);

    $usage = app(UsageService::class)->forDay($till['branch'], '2026-10-07');

    expect($usage)->toEqualCanonicalizing([
        $beans->id => 0.1,
        $freshMilk->id => 0.44,
        $oatMilk->id => 0.22,
        $croissants->id => 3.0,
    ]);
});

test('counts an order on the day it was paid, in the café\'s time zone', function (string $paidAt, bool $counted) {
    $till = branchWithMenu();
    $croissants = StockItem::factory()->create();
    $till['croissant']->ingredients()->attach($croissants->id, ['qty' => 1]);
    soldLine($till['branch'], $till['croissant'], order: ['created_at' => '2026-10-05 02:00:00', 'paid_at' => $paidAt]);

    $usage = app(UsageService::class)->forDay($till['branch'], '2026-10-07');

    expect($usage[$croissants->id] ?? 0)->toEqual($counted ? 1 : 0);
})->with([
    'just after midnight in Manila' => ['2026-10-06 16:30:00', true],
    'late the evening before in Manila' => ['2026-10-06 15:30:00', false],
    'the next day in Manila' => ['2026-10-07 16:30:00', false],
]);

test('leaves out unpaid orders, refunds and other branches', function (Closure $sell) {
    $till = branchWithMenu();
    $croissants = StockItem::factory()->create();
    $till['croissant']->ingredients()->attach($croissants->id, ['qty' => 1]);
    $sell($till);

    $usage = app(UsageService::class)->forDay($till['branch'], '2026-10-07');

    expect($usage)->toBe([]);
})->with([
    'an unpaid tab' => [fn (array $till) => soldLine($till['branch'], $till['croissant'], order: ['unpaid' => true, 'paid_at' => null])],
    'a refund' => [fn (array $till) => soldLine($till['branch'], $till['croissant'], order: ['refund_of' => Order::factory()->for($till['branch'])->create()->id])],
    'another branch\'s sale' => [fn (array $till) => soldLine(Branch::factory()->create(), $till['croissant'])],
]);

test('totals what sold by item for the period', function () {
    $till = branchWithMenu();
    soldLine($till['branch'], $till['croissant'], ['qty' => 3, 'line_total' => 180]);
    soldLine($till['branch'], $till['croissant'], ['qty' => 1, 'line_total' => 60]);
    soldLine($till['branch'], $till['espresso'], ['qty' => 1, 'line_total' => 95]);

    $sales = app(UsageService::class)->salesByItem($till['branch'], Carbon::parse('2026-10-06 16:00:00'), Carbon::parse('2026-10-07 15:59:59'));

    expect($sales)->toBe([
        ['name' => 'Butter Croissant', 'category' => $till['branch']->categories()->value('name'), 'qty' => 4, 'amount' => 240.0],
        ['name' => 'Espresso', 'category' => $till['branch']->categories()->value('name'), 'qty' => 1, 'amount' => 95.0],
    ]);
});
