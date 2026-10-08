<?php

use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OrderPayment;
use App\Models\PaymentMethod;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo('2026-10-08 04:00:00');
});

/**
 * A sale at the branch, paid at the given (UTC) time, with one payment per method and amount.
 *
 * @param  array<string, float>  $payments
 */
function sale(Branch $branch, array $totals, array $payments, string $paidAt = '2026-10-08 02:00:00'): Order
{
    $order = Order::factory()->for($branch)->create([...$totals, 'paid_at' => $paidAt, 'created_at' => $paidAt]);

    foreach ($payments as $method => $amount) {
        OrderPayment::factory()->for($order)->create(['method_name' => $method, 'kind' => 'cash', 'amount' => $amount]);
    }

    return $order;
}

test('adds up sales, VAT, the senior discount, refunds and open tabs, leaving out unpaid orders', function () {
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $payLater = PaymentMethod::factory()->for($branch)->tab()->create(['name' => 'Pay later']);

    $plain = sale($branch, ['gross' => 224, 'vat' => 24, 'total' => 224], ['Cash' => 124, 'E-wallet' => 100]);
    sale($branch, ['gross' => 112, 'vat' => 0, 'vat_exempt' => 12, 'discount' => 20, 'total' => 80, 'senior' => true], ['Card' => 80]);
    sale($branch, ['gross' => -112, 'vat' => -12, 'total' => -112, 'refund_of' => $plain->id], ['Cash back' => -112]);
    Order::factory()->for($branch)->unpaid()->create(['gross' => 112, 'vat' => 12, 'total' => 112, 'tab_name' => 'Ana', 'tab_payment_method_id' => $payLater->id, 'created_at' => '2026-10-08 03:00:00']);
    Order::factory()->for($branch)->fromBranchMenu()->create(['gross' => 500, 'vat' => 53.57, 'total' => 500, 'created_at' => '2026-10-08 03:00:00']);

    $response = $this->actingAs($lead)->get('/sales');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('sales')
        ->where('report.totals', ['tx' => 3, 'gross' => 336, 'total' => 304, 'net' => 300, 'vat' => 24, 'vat_exempt' => 12, 'discount' => 20])
        ->where('report.methods', [
            ['name' => 'Cash', 'amount' => 124],
            ['name' => 'Pay later (unpaid)', 'amount' => 112],
            ['name' => 'E-wallet', 'amount' => 100],
            ['name' => 'Card', 'amount' => 80],
            ['name' => 'Cash back', 'amount' => -112],
        ]));
});

test('counts each sale on the business day it was paid', function () {
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    sale($branch, ['gross' => 112, 'vat' => 12, 'total' => 112], ['Cash' => 112], '2026-10-06 17:00:00');
    sale($branch, ['gross' => 95, 'vat' => 10.18, 'total' => 95], ['Cash' => 95], '2026-10-06 15:00:00');

    $response = $this->actingAs($lead)->get('/sales?from=2026-10-06&to=2026-10-07');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('range', ['from' => '2026-10-06', 'to' => '2026-10-07'])
        ->where('report.days.0.date', '2026-10-06')
        ->where('report.days.0.total', 95)
        ->where('report.days.1.date', '2026-10-07')
        ->where('report.days.1.total', 112));
});

test('reports items by the branch category and takes refunded quantities off', function () {
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $latte = MenuItem::factory()->create(['name' => 'Cafe Latte']);
    BranchMenuItem::factory()->for($branch)->for($latte)->for(Category::factory()->for($branch)->create(['name' => 'Espresso']))->create();
    $sale = sale($branch, ['gross' => 280, 'vat' => 30, 'total' => 280], ['Cash' => 280]);
    $line = OrderLine::factory()->for($sale)->create(['menu_item_id' => $latte->id, 'name' => 'Cafe Latte', 'qty' => 2, 'line_total' => 280]);
    $refund = sale($branch, ['gross' => -140, 'vat' => -15, 'total' => -140, 'refund_of' => $sale->id], ['Cash back' => -140]);
    OrderLine::factory()->for($refund)->create(['menu_item_id' => $latte->id, 'refund_of_line_id' => $line->id, 'name' => 'Cafe Latte', 'qty' => 1, 'line_total' => -140]);

    $response = $this->actingAs($lead)->get('/sales');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('report.items', [['name' => 'Cafe Latte', 'category' => 'Espresso', 'qty' => 1, 'amount' => 140]])
        ->where('report.categories', [['name' => 'Espresso', 'amount' => 140]]));
});

test('keeps a branch lead to their own branch', function () {
    $branch = Branch::factory()->create();
    $other = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    sale($other, ['gross' => 112, 'vat' => 12, 'total' => 112], ['Cash' => 112]);

    $response = $this->actingAs($lead)->get("/sales?branch={$other->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('branch.id', $branch->id)
        ->where('branches', null)
        ->where('report.totals.tx', 0));
});

test('lets the Owner report on every café branch or pick one', function () {
    $iriga = Branch::factory()->create();
    $naga = Branch::factory()->create();
    $owner = User::factory()->withRole('Owner')->create();
    sale($iriga, ['gross' => 112, 'vat' => 12, 'total' => 112], ['Cash' => 112]);
    sale($naga, ['gross' => 95, 'vat' => 10.18, 'total' => 95], ['Cash' => 95]);

    $this->actingAs($owner)->get('/sales')
        ->assertInertia(fn (Assert $page) => $page->where('branch', null)->where('report.totals.total', 207)->has('report.branches', 2));
    $this->actingAs($owner)->get("/sales?branch={$naga->id}")
        ->assertInertia(fn (Assert $page) => $page->where('branch.id', $naga->id)->where('report.totals.total', 95));
});

test('refuses sales to someone with the page open but no café branch', function () {
    $agent = User::factory()->withRole('Marketing')->create();
    $agent->permissionOverrides()->create(['area' => 'sales', 'allowed' => true]);

    $this->actingAs($agent)->get('/sales')->assertForbidden();
});
