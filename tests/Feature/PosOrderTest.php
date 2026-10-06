<?php

use App\Enums\OrderStatus;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * A large oat latte with an extra shot (₱140 + ₱25 + ₱20 + ₱35 = ₱220) and a ₱60 croissant: ₱280 in all.
 *
 * @param  array{latte: MenuItem, croissant: MenuItem, extraShot: Addon}  $till
 * @return array<string, mixed>
 */
function twoEightyOrder(array $till, array $overrides = []): array
{
    return [
        'service' => 'dine_in',
        'ticket' => 5,
        'lines' => [
            ['menu_item_id' => $till['latte']->id, 'qty' => 1, 'size' => 'large', 'milk' => 'oat', 'addon_ids' => [$till['extraShot']->id]],
            ['menu_item_id' => $till['croissant']->id, 'qty' => 1],
        ],
        ...$overrides,
    ];
}

test('charges a cash sale priced from the menu, with VAT included', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['cash']->id,
        'tendered' => '500',
    ]));

    $order = Order::sole();
    $response->assertRedirect(route('pos'))->assertSessionHas('receipt_order_id', $order->id);
    expect($order)
        ->gross->toBe('280.00')
        ->vat->toBe('30.00')
        ->vat_exempt->toBe('0.00')
        ->discount->toBe('0.00')
        ->total->toBe('280.00')
        ->unpaid->toBeFalse()
        ->status->toBe(OrderStatus::Preparing);
    $this->assertDatabaseHas('order_lines', ['order_id' => $order->id, 'name' => 'Cafe Latte', 'size' => 'large', 'milk' => 'oat', 'unit_price' => 140, 'extras' => 80, 'line_total' => 220]);
    $this->assertDatabaseHas('order_line_addons', ['addon_id' => $till['extraShot']->id, 'name' => 'Extra shot', 'price' => 35]);
    $this->assertDatabaseHas('order_payments', ['order_id' => $order->id, 'method_name' => 'Cash', 'amount' => 280, 'tendered' => 500, 'change' => 220]);
});

test('records VAT and the senior/PWD discount', function (string $item, bool $senior, array $expected) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    unlockedTill($till['branch'])->post('/pos/orders', [
        'service' => 'takeout',
        'ticket' => 1,
        'senior' => $senior,
        'lines' => [['menu_item_id' => $till[$item]->id, 'qty' => $item === 'croissant' ? 4 : 1]],
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]);

    expect(Order::sole()->only(['gross', 'vat_exempt', 'discount', 'vat', 'total']))->toBe($expected);
    $this->assertDatabaseHas('order_payments', ['method_name' => 'Card', 'amount' => $expected['total']]);
})->with([
    'regular ₱240' => ['croissant', false, ['gross' => '240.00', 'vat_exempt' => '0.00', 'discount' => '0.00', 'vat' => '25.71', 'total' => '240.00']],
    'senior/PWD ₱240: VAT off, then 20% off ₱214.29' => ['croissant', true, ['gross' => '240.00', 'vat_exempt' => '25.71', 'discount' => '42.86', 'vat' => '0.00', 'total' => '171.43']],
    'regular ₱95' => ['espresso', false, ['gross' => '95.00', 'vat_exempt' => '0.00', 'discount' => '0.00', 'vat' => '10.18', 'total' => '95.00']],
    'senior/PWD ₱95: VAT off, then 20% off ₱84.82' => ['espresso', true, ['gross' => '95.00', 'vat_exempt' => '10.18', 'discount' => '16.96', 'vat' => '0.00', 'total' => '67.86']],
]);

test('refuses cash that is less than the amount due', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['cash']->id,
        'tendered' => '279.99',
    ]));

    $response->assertSessionHasErrors(['tendered' => 'Cash tendered is less than the amount due.']);
    $this->assertDatabaseEmpty('orders');
});

test('refuses add-ons the item does not offer here', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'lines' => [['menu_item_id' => $till['latte']->id, 'qty' => 1, 'addon_ids' => [$till['vanilla']->id]]],
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertSessionHasErrors(['lines.0.addon_ids' => "An add-on on Cafe Latte isn't available here."]);
    $this->assertDatabaseEmpty('orders');
});

test('records each part of a split payment and gives change from the cash part', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => true,
        'parts' => [
            ['payment_method_id' => $till['card']->id, 'amount' => '200'],
            ['payment_method_id' => $till['cash']->id, 'amount' => '100'],
        ],
    ]));

    $order = Order::sole();
    expect($order->payments->map->only(['method_name', 'amount', 'tendered', 'change'])->all())->toBe([
        ['method_name' => 'Card', 'amount' => '200.00', 'tendered' => null, 'change' => '0.00'],
        ['method_name' => 'Cash', 'amount' => '80.00', 'tendered' => '100.00', 'change' => '20.00'],
    ])->and($order->payments->sum('amount'))->toEqual($order->total);
});

test('refuses a split that breaks the split rules', function (Closure $parts, string $message) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, ['split' => true, 'parts' => $parts($till)]));

    $response->assertSessionHasErrors(['parts' => $message]);
    $this->assertDatabaseEmpty('orders');
    $this->assertDatabaseEmpty('order_payments');
})->with([
    'short of the amount due' => [
        fn (array $till) => [['payment_method_id' => $till['card']->id, 'amount' => '100'], ['payment_method_id' => $till['cash']->id, 'amount' => '100']],
        'Split is short by ₱80.',
    ],
    'overpaid with no cash' => [
        fn (array $till) => [['payment_method_id' => $till['card']->id, 'amount' => '200'], ['payment_method_id' => $till['ewallet']->id, 'amount' => '100']],
        'Overpayment needs a cash payment to give change from.',
    ],
    'overpaid by more than the cash part' => [
        fn (array $till) => [['payment_method_id' => $till['card']->id, 'amount' => '300'], ['payment_method_id' => $till['cash']->id, 'amount' => '20']],
        'Only the cash part can go over the amount due.',
    ],
    'a tab in the split' => [
        fn (array $till) => [['payment_method_id' => $till['card']->id, 'amount' => '200'], ['payment_method_id' => $till['payLater']->id, 'amount' => '80']],
        "Pay later can't be part of a split payment.",
    ],
]);

test('opens a tab as an unpaid order with no payment yet', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    unlockedTill($till['branch'], 'Branch lead')->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['payLater']->id,
        'tab_name' => 'Table 4 · Mr. Santos',
    ]));

    expect(Order::sole())
        ->unpaid->toBeTrue()
        ->paid_at->toBeNull()
        ->tab_name->toBe('Table 4 · Mr. Santos')
        ->tab_payment_method_id->toBe($till['payLater']->id);
    $this->assertDatabaseEmpty('order_payments');
});

test('refuses a tab over the method\'s limit', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'lines' => [['menu_item_id' => $till['latte']->id, 'qty' => 8]],
        'split' => false,
        'payment_method_id' => $till['payLater']->id,
        'tab_name' => 'Mr. Santos',
    ]));

    $response->assertSessionHasErrors(['payment_method_id' => 'Over the ₱1,000 limit for Pay later.']);
    $this->assertDatabaseEmpty('orders');
});

test('allows a tab up to the limit', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $till['payLater']->update(['tab_limit' => 280]);

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['payLater']->id,
        'tab_name' => 'Mr. Santos',
    ]));

    $response->assertSessionHasNoErrors();
    expect(Order::sole()->unpaid)->toBeTrue();
});

test('lets only a Branch lead or the Owner open a lead-only tab', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'], 'Cashier')->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['payLater']->id,
        'tab_name' => 'Mr. Santos',
    ]));

    $response->assertSessionHasErrors(['payment_method_id' => 'Only a Branch lead or the Owner can open a Pay later tab.']);
    $this->assertDatabaseEmpty('orders');
});

test('lets any cashier open a tab that is not lead-only', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $till['payLater']->update(['lead_only' => false]);

    $response = unlockedTill($till['branch'], 'Cashier')->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['payLater']->id,
        'tab_name' => 'Mr. Santos',
    ]));

    $response->assertSessionHasNoErrors();
    expect(Order::sole()->unpaid)->toBeTrue();
});

test('accepts tickets 01 to 25', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'ticket' => 25,
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertSessionHasNoErrors();
    $this->assertDatabaseHas('orders', ['branch_id' => $till['branch']->id, 'ticket' => 25]);
});

test('refuses a ticket outside 01 to 25', function (int $ticket) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'ticket' => $ticket,
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertSessionHasErrors(['ticket' => 'Pick a ticket from 01 to 25.']);
    $this->assertDatabaseEmpty('orders');
})->with(['zero' => [0], 'one past the last' => [26]]);

test('refuses a ticket that is still held by an open order', function (OrderStatus $status) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    Order::factory()->for($till['branch'])->create(['ticket' => 5, 'status' => $status]);

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertSessionHasErrors(['ticket' => 'Ticket 05 is still open. Pick another ticket.']);
    expect(Order::count())->toBe(1);
})->with([OrderStatus::Preparing, OrderStatus::Ready]);

test('reuses a ticket once its order is served, and ignores other branches\' tickets', function (Closure $makeOrder) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $makeOrder($till['branch']);

    $response = unlockedTill($till['branch'])->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertSessionHasNoErrors();
    $this->assertDatabaseHas('orders', ['branch_id' => $till['branch']->id, 'ticket' => 5, 'status' => OrderStatus::Preparing]);
})->with([
    'served order at this branch' => [fn (Branch $branch) => Order::factory()->for($branch)->served()->create(['ticket' => 5])],
    'open order at another branch' => [fn (Branch $branch) => Order::factory()->create(['ticket' => 5])],
]);

test('numbers orders in one sequence per branch', function () {
    $this->seed(RoleSeeder::class);
    $iriga = branchWithMenu();
    $naga = branchWithMenu();
    $sale = fn (array $till, int $ticket) => twoEightyOrder($till, ['ticket' => $ticket, 'split' => false, 'payment_method_id' => $till['card']->id]);

    unlockedTill($iriga['branch'])->post('/pos/orders', $sale($iriga, 1));
    unlockedTill($iriga['branch'], 'Cashier')->post('/pos/orders', $sale($iriga, 2));
    unlockedTill($naga['branch'])->post('/pos/orders', $sale($naga, 1));

    expect($iriga['branch']->orders()->orderBy('id')->pluck('no')->all())->toBe([1, 2])
        ->and($naga['branch']->orders()->pluck('no')->all())->toBe([1]);
});

test('takes payment for an unpaid order, with the senior/PWD discount', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $order = Order::factory()->for($till['branch'])->fromBranchMenu()->create(['gross' => 280, 'vat' => 30, 'total' => 280]);

    $response = unlockedTill($till['branch'], 'Cashier')->post("/pos/orders/{$order->id}/settle", [
        'senior' => true,
        'split' => false,
        'payment_method_id' => $till['cash']->id,
        'tendered' => '200',
    ]);

    $response->assertRedirect(route('pos'));
    expect($order->fresh())
        ->unpaid->toBeFalse()
        ->paid_at->not->toBeNull()
        ->total->toBe('200.00')
        ->vat_exempt->toBe('30.00')
        ->discount->toBe('50.00');
    $this->assertDatabaseHas('order_payments', ['order_id' => $order->id, 'method_name' => 'Cash', 'amount' => 200, 'change' => 0]);
});

test('returns 404 for another branch\'s order', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $otherBranchOrder = Order::factory()->fromBranchMenu()->create();

    $response = unlockedTill($till['branch'])->post("/pos/orders/{$otherBranchOrder->id}/settle", [
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]);

    $response->assertNotFound();
    expect($otherBranchOrder->fresh()->unpaid)->toBeTrue();
});

test('moves an order to the next step on the queue', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $order = Order::factory()->for($till['branch'])->create(['status' => OrderStatus::Ready]);

    unlockedTill($till['branch'])->patch("/pos/orders/{$order->id}/status", ['status' => 'served']);

    expect($order->fresh()->status)->toBe(OrderStatus::Served);
});

test('shows the unlocked till with its queue and the last receipt', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $paid = Order::factory()->for($till['branch'])->create(['ticket' => 2]);
    $tab = Order::factory()->for($till['branch'])->unpaid()->served()->create(['ticket' => 7]);
    Order::factory()->for($till['branch'])->served()->create(['ticket' => 9]);

    $response = unlockedTill($till['branch'])->withSession(['receipt_order_id' => $paid->id])->get('/pos');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('till/index')
        ->where('orderOnly', false)
        ->where('openTickets', [2])
        ->where('queue.0.id', $tab->id)
        ->where('queue.1.id', $paid->id)
        ->missing('queue.2')
        ->where('receipt.total', 112)
        ->where('menu.0.price', 140)
    );
});

test('sends a locked till back to the PIN pad', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $cashier = User::factory()->withRole('Cashier')->for($till['branch'])->create();

    $response = $this->actingAs($cashier)->post('/pos/orders', twoEightyOrder($till, [
        'split' => false,
        'payment_method_id' => $till['card']->id,
    ]));

    $response->assertRedirect(route('pos'))->assertSessionHasErrors(['pin' => 'The till is locked. Enter your PIN to continue.']);
    $this->assertDatabaseEmpty('orders');
});
