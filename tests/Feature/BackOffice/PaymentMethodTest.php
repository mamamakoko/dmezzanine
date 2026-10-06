<?php

use App\Enums\PaymentMethodKind;
use App\Models\PaymentMethod;
use Database\Seeders\RoleSeeder;

test('lets a Branch lead rename their branch\'s payment method, and logs it', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->put("/pos/payment-methods/{$till['card']->id}", [
        'name' => 'Visa / Mastercard',
        'kind' => 'card',
        'split' => true,
        'terminal' => 'BDO terminal',
    ]);

    $response->assertSessionHasNoErrors();
    expect($till['card']->fresh())->name->toBe('Visa / Mastercard')->terminal->toBe('BDO terminal');
    $this->assertDatabaseHas('payment_method_log', [
        'branch_id' => $till['branch']->id,
        'payment_method_id' => $till['card']->id,
        'description' => 'renamed Card to Visa / Mastercard',
    ]);
});

test('stops a Branch lead from changing another branch\'s payment methods', function (string $method, string $suffix, array $payload) {
    $this->seed(RoleSeeder::class);
    $mine = branchWithMenu();
    $theirs = branchWithMenu();

    $response = unlockedTill($mine['branch'])->{$method}("/pos/payment-methods/{$theirs['card']->id}{$suffix}", $payload);

    $response->assertNotFound();
    expect($theirs['card']->fresh())->name->toBe('Card')->active->toBeTrue();
    $this->assertDatabaseEmpty('payment_method_log');
})->with([
    'edit' => ['put', '', ['name' => 'Hijacked', 'kind' => 'card']],
    'switch off' => ['patch', '/toggle', ['active' => false]],
    'remove' => ['delete', '', []],
]);

test('stops a cashier from changing payment methods', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'], 'Cashier')->patch("/pos/payment-methods/{$till['card']->id}/toggle", ['active' => false]);

    $response->assertForbidden();
    expect($till['card']->fresh()->active)->toBeTrue();
});

test('keeps at least one payment method on', function (string $method, string $suffix, array $payload) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    PaymentMethod::whereKeyNot($till['cash']->id)->update(['active' => false]);

    $response = unlockedTill($till['branch'])->{$method}("/pos/payment-methods/{$till['cash']->id}{$suffix}", $payload);

    $response->assertSessionHasErrors(['payment_method']);
    expect($till['cash']->fresh())->not->toBeNull()->active->toBeTrue();
    $this->assertDatabaseEmpty('payment_method_log');
})->with([
    'switching off the last one on' => ['patch', '/toggle', ['active' => false]],
    'removing the last one on' => ['delete', '', []],
]);

test('switches a method off while another stays on', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->patch("/pos/payment-methods/{$till['card']->id}/toggle", ['active' => false]);

    $response->assertSessionHasNoErrors();
    expect($till['card']->fresh()->active)->toBeFalse();
    $this->assertDatabaseHas('payment_method_log', ['description' => 'switched Card off']);
});

test('adds a tab method that can never be split', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    unlockedTill($till['branch'])->post('/pos/payment-methods', [
        'name' => 'Staff tab',
        'kind' => 'tab',
        'split' => true,
        'tab_limit' => 500,
        'lead_only' => false,
        'terminal' => 'ignored',
    ]);

    expect(PaymentMethod::where('name', 'Staff tab')->sole())
        ->branch_id->toBe($till['branch']->id)
        ->kind->toBe(PaymentMethodKind::Tab)
        ->split->toBeFalse()
        ->tab_limit->toBe('500.00')
        ->terminal->toBeNull();
});

test('refuses a second method with the same name at the branch', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'])->post('/pos/payment-methods', ['name' => 'Cash', 'kind' => 'cash']);

    $response->assertSessionHasErrors(['name' => 'This branch already has a method with that name.']);
});
