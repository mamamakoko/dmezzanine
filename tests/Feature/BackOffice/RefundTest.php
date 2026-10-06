<?php

use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\User;
use Database\Seeders\RoleSeeder;

/**
 * A paid ₱280 sale: two ₱140 lattes, ₱30 VAT included.
 */
function twoLatteSale(Branch $branch): Order
{
    $sale = Order::factory()->for($branch)->served()->create(['gross' => 280, 'vat' => 30, 'total' => 280]);
    OrderLine::factory()->for($sale)->create(['name' => 'Cafe Latte', 'unit_price' => 140, 'qty' => 2, 'line_total' => 280]);
    $sale->payments()->create(['method_name' => 'Cash', 'kind' => 'cash', 'amount' => 280, 'tendered' => 300, 'change' => 20]);

    return $sale;
}

test('refunds one of two items with a manager\'s PIN', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    $sale = twoLatteSale($till['branch']);

    $response = tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", [
        'lines' => [['order_line_id' => $sale->lines->sole()->id, 'qty' => 1]],
        'reason' => 'Quality',
        'method' => 'Cash back',
        'pin' => '5678',
    ]);

    $response->assertSessionHasNoErrors();
    $refund = Order::where('refund_of', $sale->id)->sole();
    expect($refund)
        ->gross->toBe('-140.00')
        ->vat->toBe('-15.00')
        ->total->toBe('-140.00')
        ->ticket->toBeNull()
        ->refund_reason->toBe('Quality')
        ->approved_by_id->toBe($lead->id)
        ->no->toBe($till['branch']->fresh()->last_order_no);
    $this->assertDatabaseHas('order_lines', ['order_id' => $refund->id, 'refund_of_line_id' => $sale->lines->sole()->id, 'qty' => 1, 'line_total' => -140]);
    $this->assertDatabaseHas('order_payments', ['order_id' => $refund->id, 'method_name' => 'Cash back', 'amount' => -140]);
});

test('refunds a senior/PWD sale in parts down to exactly what was paid', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    $sale = Order::factory()->for($till['branch'])->served()->create([
        'gross' => 120, 'vat_exempt' => 12.86, 'discount' => 21.43, 'vat' => 0, 'total' => 85.71, 'senior' => true,
    ]);
    $line = OrderLine::factory()->for($sale)->create(['name' => 'Butter Croissant', 'unit_price' => 60, 'qty' => 2, 'line_total' => 120]);
    $refundOne = ['lines' => [['order_line_id' => $line->id, 'qty' => 1]], 'reason' => 'Wrong order', 'method' => 'Cash back', 'pin' => '5678'];

    tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", $refundOne);
    tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", $refundOne);

    expect(Order::where('refund_of', $sale->id)->orderBy('id')->pluck('total')->all())->toBe(['-42.86', '-42.85']);
});

test('refuses a refund without a manager\'s PIN', function (string $pin) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    User::factory()->withRole('Cashier')->for($till['branch'])->create(['pin_hash' => '1234']);
    User::factory()->withRole('Branch lead')->for(Branch::factory())->create(['pin_hash' => '4321']);
    $sale = twoLatteSale($till['branch']);

    $response = tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", [
        'lines' => [['order_line_id' => $sale->lines->sole()->id, 'qty' => 1]],
        'reason' => 'Quality',
        'method' => 'Cash back',
        'pin' => $pin,
    ]);

    $response->assertSessionHasErrors(['pin' => "That isn't a manager's PIN. A Branch lead or the Owner approves refunds."]);
    expect(Order::whereNotNull('refund_of')->exists())->toBeFalse();
})->with([
    'a cashier\'s PIN' => ['1234'],
    'another branch\'s lead' => ['4321'],
    'nobody\'s PIN' => ['0000'],
]);

test('refuses to refund more than is left on a line', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    $sale = twoLatteSale($till['branch']);
    $line = $sale->lines->sole();
    $refund = ['reason' => 'Quality', 'method' => 'Cash back', 'pin' => '5678'];
    tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", $refund + ['lines' => [['order_line_id' => $line->id, 'qty' => 1]]]);

    $response = tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$sale->id}/refunds", $refund + ['lines' => [['order_line_id' => $line->id, 'qty' => 2]]]);

    $response->assertSessionHasErrors(['lines.0.qty' => 'Only 1 of Cafe Latte can still be refunded.']);
    expect(Order::where('refund_of', $sale->id)->count())->toBe(1);
});

test('stops a cashier from refunding, even with a manager\'s PIN', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    $sale = twoLatteSale($till['branch']);

    $response = unlockedTill($till['branch'], 'Cashier')->post("/pos/orders/{$sale->id}/refunds", [
        'lines' => [['order_line_id' => $sale->lines->sole()->id, 'qty' => 1]],
        'reason' => 'Quality',
        'method' => 'Cash back',
        'pin' => '5678',
    ]);

    $response->assertForbidden();
    expect(Order::whereNotNull('refund_of')->exists())->toBeFalse();
});

test('returns 404 for another branch\'s sale', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $lead = User::factory()->withRole('Branch lead')->for($till['branch'])->create(['pin_hash' => '5678']);
    $theirSale = twoLatteSale(Branch::factory()->create());

    $response = tillUnlockedFor($lead, $till['branch'])->post("/pos/orders/{$theirSale->id}/refunds", [
        'lines' => [['order_line_id' => $theirSale->lines->sole()->id, 'qty' => 1]],
        'reason' => 'Quality',
        'method' => 'Cash back',
        'pin' => '5678',
    ]);

    $response->assertNotFound();
});
