<?php

use App\Models\Addon;
use App\Models\Branch;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

test('decides who runs a branch\'s back office', function (string $role, bool $atThisBranch, bool $active, int $expectedStatus) {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $user = User::factory()->withRole($role)->for($atThisBranch ? $branch : Branch::factory()->create())->create(['active' => $active]);

    $response = Gate::forUser($user)->inspect('manage', $branch);

    expect($response->allowed() ? 200 : $response->status() ?? 403)->toBe($expectedStatus);
})->with([
    'Owner at another branch' => ['Owner', false, true, 200],
    'Branch lead of this branch' => ['Branch lead', true, true, 200],
    'Branch lead of another branch' => ['Branch lead', false, true, 404],
    'Cashier at this branch' => ['Cashier', true, true, 403],
    'inactive Branch lead of this branch' => ['Branch lead', true, false, 403],
]);

test('lets only the Owner change the shared add-on list', function (string $role, bool $allowed) {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $user = User::factory()->withRole($role)->for($branch)->create();

    expect(Gate::forUser($user)->allows('update', Addon::factory()->create()))->toBe($allowed)
        ->and(Gate::forUser($user)->allows('create', Addon::class))->toBe($allowed);
})->with([
    'Owner' => ['Owner', true],
    'Branch lead' => ['Branch lead', false],
    'Cashier' => ['Cashier', false],
]);
