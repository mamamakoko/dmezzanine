<?php

use App\Enums\PermissionArea;
use App\Models\Branch;
use App\Models\User;
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

test('hides the PIN hash when serialized', function () {
    $user = User::factory()->create(['pin_hash' => '1234']);

    expect($user->toArray())->not->toHaveKey('pin_hash')
        ->and(Hash::check('1234', $user->pin_hash))->toBeTrue();
});
