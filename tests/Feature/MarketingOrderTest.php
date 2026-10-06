<?php

use App\Enums\MarketingOrderStatus;
use App\Enums\OrderSource;
use App\Models\Branch;
use App\Models\MarketingOrder;
use App\Models\MarketingOrderLine;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A marketing order for two lattes with an extra shot and four croissants.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function marketingOrder(array $till, array $overrides = []): array
{
    return [
        'branch_id' => $till['branch']->id,
        'service' => 'delivery',
        'customer' => 'Sunrise Dental Clinic',
        'phone' => '0917 555 0101',
        'address' => 'San Roque, Iriga City',
        'wanted_on' => '2026-10-09',
        'wanted_at' => '10:30',
        'note' => 'Packed per 6',
        'lines' => [
            ['menu_item_id' => $till['latte']->id, 'qty' => 2, 'addon_ids' => [$till['extraShot']->id]],
            ['menu_item_id' => $till['croissant']->id, 'qty' => 4],
        ],
        ...$overrides,
    ];
}

/**
 * An order waiting in the branch's inbox, for two lattes with an extra shot.
 */
function waitingMarketingOrder(array $till): MarketingOrder
{
    $order = MarketingOrder::factory()->for($till['branch'])->create(['customer' => 'Sunrise Dental Clinic']);
    MarketingOrderLine::factory()->for($order)->create([
        'menu_item_id' => $till['latte']->id,
        'name' => 'Cafe Latte',
        'qty' => 2,
        'addons' => [['id' => $till['extraShot']->id, 'name' => 'Extra shot']],
    ]);

    return $order;
}

test('sends an order to the branch with its add-ons and no prices', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $agent = User::factory()->withRole('Marketing')->create();

    $response = $this->actingAs($agent)->post('/marketing/orders', marketingOrder($till));

    $response->assertSessionHasNoErrors();
    $order = MarketingOrder::sole();
    expect($order)
        ->agent_id->toBe($agent->id)
        ->status->toBe(MarketingOrderStatus::Sent)
        ->customer->toBe('Sunrise Dental Clinic')
        ->and($order->lines->map->only(['name', 'qty', 'addons'])->all())->toBe([
            ['name' => 'Cafe Latte', 'qty' => 2, 'addons' => [['id' => $till['extraShot']->id, 'name' => 'Extra shot']]],
            ['name' => 'Butter Croissant', 'qty' => 4, 'addons' => []],
        ]);
});

test('refuses items or add-ons the branch can\'t make', function (Closure $lines, string $field) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $agent = User::factory()->withRole('Marketing')->create();

    $response = $this->actingAs($agent)->post('/marketing/orders', marketingOrder($till, ['lines' => $lines($till)]));

    $response->assertSessionHasErrors([$field]);
    $this->assertDatabaseEmpty('marketing_orders');
})->with([
    'an item off the board' => [function (array $till) {
        $till['branch']->menuEntries()->where('menu_item_id', $till['croissant']->id)->update(['available' => false]);

        return [['menu_item_id' => $till['croissant']->id, 'qty' => 1]];
    }, 'lines.0.menu_item_id'],
    'an add-on switched off at the branch' => [fn (array $till) => [['menu_item_id' => $till['latte']->id, 'qty' => 1, 'addon_ids' => [$till['vanilla']->id]]], 'lines.0.addon_ids'],
]);

test('returns 403 to staff without the Marketing area', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $cashier = User::factory()->withRole('Cashier')->for($till['branch'])->create();

    $response = $this->actingAs($cashier)->post('/marketing/orders', marketingOrder($till));

    $response->assertForbidden();
});

test('accepting puts the order on the queue unpaid, priced from the menu, on the first free ticket', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    Order::factory()->for($till['branch'])->create(['ticket' => 1]);
    $marketingOrder = waitingMarketingOrder($till);

    $response = unlockedTill($till['branch'])->post("/pos/inbox/{$marketingOrder->id}/accept");

    $response->assertSessionHasNoErrors();
    $order = Order::where('source', OrderSource::Marketing)->sole();
    expect($order)
        ->ticket->toBe(2)
        ->unpaid->toBeTrue()
        ->gross->toBe('350.00')
        ->and($marketingOrder->fresh())
        ->status->toBe(MarketingOrderStatus::Accepted)
        ->order_id->toBe($order->id)
        ->reply->toBe('accepted it · ticket 02');
});

test('settling an accepted marketing order records it as paid', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $marketingOrder = waitingMarketingOrder($till);
    unlockedTill($till['branch'])->post("/pos/inbox/{$marketingOrder->id}/accept");
    $order = $marketingOrder->fresh()->order;

    unlockedTill($till['branch'])->post("/pos/orders/{$order->id}/settle", ['split' => false, 'payment_method_id' => $till['card']->id]);

    expect($order->fresh())->unpaid->toBeFalse()->paid_at->not->toBeNull();
    $this->assertDatabaseHas('order_payments', ['order_id' => $order->id, 'method_name' => 'Card', 'amount' => 350]);
});

test('declines an order with the branch\'s reply', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $marketingOrder = waitingMarketingOrder($till);

    unlockedTill($till['branch'])->post("/pos/inbox/{$marketingOrder->id}/decline", ['reply' => 'Fully booked that morning']);

    expect($marketingOrder->fresh())->status->toBe(MarketingOrderStatus::Declined)->reply->toBe('Fully booked that morning');
    $this->assertDatabaseEmpty('orders');
});

test('refuses to answer an order twice', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $marketingOrder = MarketingOrder::factory()->for($till['branch'])->declined()->create();

    $response = unlockedTill($till['branch'])->post("/pos/inbox/{$marketingOrder->id}/accept");

    $response->assertSessionHasErrors(['marketing_order' => "{$marketingOrder->number()} has already been declined."]);
    $this->assertDatabaseEmpty('orders');
});

test('returns 404 for another branch\'s marketing order', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $theirs = MarketingOrder::factory()->for(Branch::factory())->create();

    $response = unlockedTill($till['branch'])->post("/pos/inbox/{$theirs->id}/decline");

    $response->assertNotFound();
    expect($theirs->fresh()->status)->toBe(MarketingOrderStatus::Sent);
});

test('shows marketing each branch\'s available menu without a single price', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $till['branch']->menuEntries()->where('menu_item_id', $till['espresso']->id)->update(['available' => false]);
    $agent = User::factory()->withRole('Marketing')->create();
    MarketingOrderLine::factory()->for(MarketingOrder::factory()->for($till['branch'])->for($agent, 'agent'))->create();

    $response = $this->actingAs($agent)->get('/marketing');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('marketing/index')
        ->where('branches.0.items', fn ($items) => collect($items)->pluck('name')->sort()->values()->all() === ['Butter Croissant', 'Cafe Latte'])
        ->where('branches.0.addons', [['id' => $till['extraShot']->id, 'name' => 'Extra shot']])
        ->has('sent', 1)
    );
    expect(json_encode($response->viewData('page')['props']))->not->toContain('"price"')
        ->not->toContain('"total"')
        ->not->toContain('"gross"');
});

test('shows the till its marketing inbox', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $waiting = waitingMarketingOrder($till);
    MarketingOrder::factory()->for(Branch::factory())->create();

    $response = unlockedTill($till['branch'])->get('/pos');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('inbox.0.id', $waiting->id)
        ->where('inbox.0.status', 'sent')
        ->where('inbox.0.lines.0.addons.0.name', 'Extra shot')
        ->missing('inbox.1')
    );
});
