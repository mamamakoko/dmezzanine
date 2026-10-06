<?php

use App\Enums\OrderSource;
use App\Models\Order;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('sends an order to the cashier unpaid, priced on the server', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $cashier = User::factory()->withRole('Cashier')->for($till['branch'])->create();

    $response = $this->actingAs($cashier)->post('/branch-menu/orders', [
        'service' => 'takeout',
        'ticket' => 3,
        'note' => 'No ice',
        'lines' => [['menu_item_id' => $till['croissant']->id, 'qty' => 2]],
        'payment_method_id' => $till['cash']->id,
        'tendered' => '1000',
    ]);

    $order = Order::sole();
    $response->assertRedirect(route('menu'))->assertSessionHas('receipt_order_id', $order->id);
    expect($order)
        ->source->toBe(OrderSource::BranchMenu)
        ->unpaid->toBeTrue()
        ->cashier_id->toBe($cashier->id)
        ->total->toBe('120.00')
        ->note->toBe('No ice');
    $this->assertDatabaseEmpty('order_payments');
});

test('shows the Branch Menu without any prices', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $cashier = User::factory()->withRole('Cashier')->for($till['branch'])->create();
    $order = Order::factory()->for($till['branch'])->fromBranchMenu()->create();

    $response = $this->actingAs($cashier)->withSession(['receipt_order_id' => $order->id])->get('/branch-menu');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('till/index')
        ->where('orderOnly', true)
        ->missing('menu.0.price')
        ->missing('addons.0.price')
        ->missing('sizes.1.price')
        ->missing('receipt.total')
        ->where('paymentMethods', [])
    );
});

test('offers only the add-ons switched on at the branch', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $cashier = User::factory()->withRole('Cashier')->for($till['branch'])->create();

    $response = $this->actingAs($cashier)->get('/branch-menu');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('menu.0.name', 'Cafe Latte')
        ->where('menu.0.addon_ids', [$till['extraShot']->id])
        ->where('addons', [['id' => $till['extraShot']->id, 'name' => 'Extra shot']])
    );
});
