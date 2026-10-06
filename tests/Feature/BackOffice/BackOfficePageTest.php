<?php

use App\Models\BranchStock;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\StockItem;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

test('opens the back office for the branch lead but not for a cashier', function (string $role, bool $opens) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'], $role)->get('/pos?inv=payments');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('canManageBranch', $opens)
        ->where('backOffice', fn ($backOffice) => $opens ? $backOffice['tab'] === 'payments' && count($backOffice['methods']) === 4 : $backOffice === null)
    );
})->with([
    'Branch lead' => ['Branch lead', true],
    'Cashier' => ['Cashier', false],
]);

test('shows on hand against par from this branch\'s stock', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $milk = StockItem::factory()->create(['name' => 'Fresh milk', 'par' => 24]);
    BranchStock::factory()->for($till['branch'])->for($milk)->create(['on_hand' => 9]);
    BranchStock::factory()->for(branchWithMenu()['branch'])->for($milk)->create(['on_hand' => 30]);

    $response = unlockedTill($till['branch'])->get('/pos?inv=stock');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('backOffice.stock.0.name', 'Fresh milk')
        ->where('backOffice.stock.0.on_hand', 9)
        ->where('backOffice.stock.0.par', 24)
        ->where('backOffice.stock.0.low', true)
    );
});

test('lists sales in the date range, using the café\'s local day', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    Carbon::setTestNow('2026-10-07 10:00:00');
    $earlyMorning = Order::factory()->for($till['branch'])->create(['created_at' => '2026-10-06 17:30:00']);
    OrderLine::factory()->for($earlyMorning)->create();
    $dayBefore = Order::factory()->for($till['branch'])->create(['created_at' => '2026-10-06 15:30:00']);

    $response = unlockedTill($till['branch'])->get('/pos?inv=sales&from=2026-10-07&to=2026-10-07');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('backOffice.receipts.0.id', $earlyMorning->id)
        ->missing('backOffice.receipts.1')
        ->where('backOffice.today', '2026-10-07')
    );
    expect($dayBefore->exists)->toBeTrue();
});
