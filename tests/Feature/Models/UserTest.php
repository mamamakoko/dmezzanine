<?php

use App\Enums\PermissionArea;
use App\Models\Branch;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Hash;

test('resolves permission overrides with their area', function () {
    $user = User::factory()->create();

    $user->permissionOverrides()->create(['area' => PermissionArea::Sales, 'allowed' => true]);

    expect($user->permissionOverrides->sole())
        ->area->toBe(PermissionArea::Sales)
        ->allowed->toBeTrue();
});

test('keeps the user when their branch is deleted', function () {
    $branch = Branch::factory()->create();
    $user = User::factory()->for($branch)->create();

    $branch->delete();

    expect($user->fresh()->branch_id)->toBeNull();
});

test('lets an override grant or remove an area the role decides by default', function () {
    $this->seed(RoleSeeder::class);
    $cashier = User::factory()->withRole('Cashier')->create();
    $cashier->permissionOverrides()->createMany([
        ['area' => PermissionArea::Sales, 'allowed' => true],
        ['area' => PermissionArea::Menu, 'allowed' => false],
    ]);

    expect($cashier->accessibleAreas())->toBe([PermissionArea::Pos, PermissionArea::Sales]);
});

test('always gives the Owner every area, even when an override removes one', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->create();
    $owner->permissionOverrides()->create(['area' => PermissionArea::Owner, 'allowed' => false]);

    expect($owner->accessibleAreas())->toBe(PermissionArea::cases());
});

test('gives inactive users no areas', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->inactive()->create();

    expect($owner->accessibleAreas())->toBe([])
        ->and($owner->can(PermissionArea::Pos->value))->toBeFalse();
});

test('hides the PIN hash when serialized', function () {
    $user = User::factory()->create(['pin_hash' => '1234']);

    expect($user->toArray())->not->toHaveKey('pin_hash')
        ->and(Hash::check('1234', $user->pin_hash))->toBeTrue();
});
