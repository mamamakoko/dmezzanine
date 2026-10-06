<?php

use App\Models\Branch;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('shows each role only its own workspaces', function (string $role, array $areas) {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->withRole($role)->create();

    $response = $this->actingAs($user)->get('/');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('landing')
        ->where('auth.role', $role)
        ->where('auth.areas', $areas));
})->with([
    'owner' => ['Owner', ['pos', 'menu', 'marketing', 'inventory', 'owner', 'sales', 'count', 'report']],
    'branch lead' => ['Branch lead', ['pos', 'menu', 'marketing', 'sales', 'count', 'report']],
    'cashier' => ['Cashier', ['pos', 'menu']],
    'warehouse' => ['Warehouse', ['inventory']],
    'commissary' => ['Commissary', ['inventory']],
    'marketing' => ['Marketing', ['marketing']],
]);

test('shares the user\'s location for the access line', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create(['name' => 'DMC-Iriga Branch']);
    $user = User::factory()->withRole('Cashier')->for($branch)->create();

    $response = $this->actingAs($user)->get('/');

    $response->assertInertia(fn (Assert $page) => $page->where('auth.branch', 'DMC-Iriga Branch'));
});

test('opens a workspace the user has access to', function () {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->withRole('Cashier')->create();

    $response = $this->actingAs($user)->get('/pos');

    $response->assertInertia(fn (Assert $page) => $page->component('workspace-pending')->where('area', 'pos'));
});

test('returns 403 for a workspace outside the user\'s access', function () {
    $this->seed(RoleSeeder::class);
    $user = User::factory()->withRole('Cashier')->create();

    $response = $this->actingAs($user)->get('/inventory');

    $response->assertForbidden();
});
