<?php

use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\StockCount;
use App\Models\StockItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

test('saves counts to today\'s sheet and locks it on submit', function () {
    $this->seed(RoleSeeder::class);
    Carbon::setTestNow('2026-10-07 13:00:00');
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $milk = StockItem::factory()->create();

    $this->actingAs($lead)->put("/stock-count/{$branch->id}/lines/{$milk->id}", ['counted' => '8.5']);
    $this->actingAs($lead)->post("/stock-count/{$branch->id}/submit")->assertSessionHasNoErrors();
    $response = $this->actingAs($lead)->put("/stock-count/{$branch->id}/lines/{$milk->id}", ['counted' => '9']);

    $response->assertSessionHasErrors(['counted' => "Today's sheet is submitted. It's read only now."]);
    $sheet = StockCount::sole();
    expect($sheet->day->toDateString())->toBe('2026-10-07')
        ->and($sheet->status)->toBe(StockCountStatus::Submitted)
        ->and($sheet->submitted_by_id)->toBe($lead->id)
        ->and($sheet->lines->sole()->counted)->toBe('8.500');
});

test('starts the sheet on the café\'s day, not the server\'s', function () {
    $this->seed(RoleSeeder::class);
    Carbon::setTestNow('2026-10-06 17:30:00');
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();

    $this->actingAs($lead)->put("/stock-count/{$branch->id}/lines/".StockItem::factory()->create()->id, ['counted' => 1]);

    expect(StockCount::sole()->day->toDateString())->toBe('2026-10-07');
});

test('refuses to submit a sheet with nothing counted', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();

    $response = $this->actingAs($lead)->post("/stock-count/{$branch->id}/submit");

    $response->assertSessionHasErrors(['sheet' => 'Count at least one item first.']);
    $this->assertDatabaseEmpty('stock_counts');
});

test('returns 404 when counting for another branch', function () {
    $this->seed(RoleSeeder::class);
    $lead = User::factory()->withRole('Branch lead')->for(Branch::factory())->create();
    $otherBranch = Branch::factory()->create();

    $response = $this->actingAs($lead)->put("/stock-count/{$otherBranch->id}/lines/".StockItem::factory()->create()->id, ['counted' => 1]);

    $response->assertNotFound();
    $this->assertDatabaseEmpty('stock_counts');
});

test('returns 403 to staff without the stock count area', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $cashier = User::factory()->withRole('Cashier')->for($branch)->create();

    $response = $this->actingAs($cashier)->put("/stock-count/{$branch->id}/lines/".StockItem::factory()->create()->id, ['counted' => 1]);

    $response->assertForbidden();
});

test('shows the roster with each item\'s beginning, plus ingredients today\'s orders used', function () {
    $this->seed(RoleSeeder::class);
    Carbon::setTestNow('2026-10-07 04:00:00');
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create();
    $milk = StockItem::factory()->create(['name' => 'Fresh milk']);
    $croissants = StockItem::factory()->create(['name' => 'Butter croissant']);
    $till['branch']->stockItems()->create(['stock_item_id' => $milk->id, 'station' => 'bar']);
    BranchStock::factory()->for($till['branch'])->for($milk)->create(['on_hand' => 9]);
    $till['croissant']->ingredients()->attach($croissants->id, ['qty' => 1]);
    $sale = Order::factory()->for($till['branch'])->create(['paid_at' => now()]);
    OrderLine::factory()->for($sale)->create(['menu_item_id' => $till['croissant']->id, 'qty' => 2]);

    $response = $this->actingAs($lead)->get('/stock-count');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('stock-count')
        ->where('today', '2026-10-07')
        ->where('items.0.name', 'Butter croissant')
        ->where('items.0.station', null)
        ->where('items.0.used_today', 2)
        ->where('items.1.name', 'Fresh milk')
        ->where('items.1.station', 'bar')
        ->where('items.1.beginning', 9)
        ->where('sheet', null)
    );
});
