<?php

use App\Enums\PermissionArea;
use App\Models\Branch;
use App\Models\User;
use Database\Seeders\RoleSeeder;

test('unlocks the till for the branch staff member whose PIN matches', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create(['pin_hash' => '5678']);
    $cashier = User::factory()->withRole('Cashier')->for($branch)->create(['pin_hash' => '1234']);

    $response = $this->actingAs($lead)->post('/pos/unlock', ['pin' => '1234']);

    $response->assertRedirect(route('pos'))
        ->assertSessionHas('pos', ['branch_id' => $branch->id, 'staff_id' => $cashier->id]);
});

test('lets the Owner unlock any branch\'s till with their PIN', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $cashier = User::factory()->withRole('Cashier')->for($branch)->create(['pin_hash' => '1234']);
    $owner = User::factory()->withRole('Owner')->create(['pin_hash' => '9999']);

    $response = $this->actingAs($cashier)->post('/pos/unlock', ['pin' => '9999']);

    $response->assertSessionHas('pos.staff_id', $owner->id);
});

test('does not accept a PIN that only matches someone who can\'t use the till here', function (Closure $makeOtherStaff) {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create(['pin_hash' => '5678']);
    $makeOtherStaff($branch);

    $response = $this->actingAs($lead)->post('/pos/unlock', ['pin' => '1234']);

    $response->assertSessionHasErrors(['pin' => 'PIN not recognised.'])
        ->assertSessionMissing('pos');
})->with([
    'cashier at another branch' => [fn (Branch $branch) => User::factory()->withRole('Cashier')->for(Branch::factory())->create(['pin_hash' => '1234'])],
    'inactive cashier' => [fn (Branch $branch) => User::factory()->withRole('Cashier')->for($branch)->inactive()->create(['pin_hash' => '1234'])],
    'cashier whose POS access was removed' => [function (Branch $branch) {
        $cashier = User::factory()->withRole('Cashier')->for($branch)->create(['pin_hash' => '1234']);
        $cashier->permissionOverrides()->create(['area' => PermissionArea::Pos, 'allowed' => false]);
    }],
    'nobody' => [fn (Branch $branch) => null],
]);

test('refuses a PIN shared by two people at the branch', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create(['pin_hash' => '1234']);
    User::factory()->withRole('Cashier')->for($branch)->create(['pin_hash' => '1234']);

    $response = $this->actingAs($lead)->post('/pos/unlock', ['pin' => '1234']);

    $response->assertSessionHasErrors(['pin' => 'That PIN belongs to more than one person. Ask the owner to reset it.'])
        ->assertSessionMissing('pos');
});

test('requires a 4-digit PIN', function (mixed $pin) {
    $this->seed(RoleSeeder::class);
    $cashier = User::factory()->withRole('Cashier')->for(Branch::factory())->create(['pin_hash' => '1234']);

    $response = $this->actingAs($cashier)->post('/pos/unlock', ['pin' => $pin]);

    $response->assertSessionHasErrors(['pin' => 'Enter a 4-digit PIN.']);
})->with([
    'missing' => [null],
    'too short' => ['123'],
    'letters' => ['12ab'],
]);

test('refuses to unlock when the signed-in user has no branch', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->create(['pin_hash' => '9999']);

    $response = $this->actingAs($owner)->post('/pos/unlock', ['pin' => '9999']);

    $response->assertSessionHasErrors(['pin' => 'Your account has no branch, so there is no till to unlock.']);
});

test('returns 403 to users without POS access', function () {
    $this->seed(RoleSeeder::class);
    $warehouse = User::factory()->withRole('Warehouse')->for(Branch::factory()->warehouse())->create(['pin_hash' => '1234']);

    $response = $this->actingAs($warehouse)->post('/pos/unlock', ['pin' => '1234']);

    $response->assertForbidden();
});

test('limits PIN attempts to five a minute', function () {
    $this->seed(RoleSeeder::class);
    $cashier = User::factory()->withRole('Cashier')->for(Branch::factory())->create(['pin_hash' => '1234']);

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($cashier)->post('/pos/unlock', ['pin' => '0000']);
    }
    $response = $this->actingAs($cashier)->post('/pos/unlock', ['pin' => '1234']);

    $response->assertTooManyRequests();
});
