<?php

use App\Models\Branch;
use App\Models\Transfer;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Gate;

/**
 * A requisition from the warehouse to a café, with the user under test placed by $where.
 */
function transferAnd(string $role, string $where, bool $active = true): array
{
    $warehouse = Branch::factory()->warehouse()->create();
    $cafe = Branch::factory()->create();
    $location = match ($where) {
        'warehouse' => $warehouse,
        'commissary' => Branch::factory()->commissary()->create(),
        'café' => $cafe,
        'another café' => Branch::factory()->create(),
        'nowhere' => null,
    };

    return [
        Transfer::factory()->for($warehouse, 'from')->for($cafe, 'to')->create(),
        User::factory()->withRole($role)->create(['branch_id' => $location?->id, 'active' => $active]),
    ];
}

$status = fn ($response) => $response->allowed() ? 200 : ($response->status() ?? 403);

test('the location asked for stock approves, rejects and issues it', function (string $role, string $where, bool $active, int $expected) use ($status) {
    $this->seed(RoleSeeder::class);
    [$transfer, $user] = transferAnd($role, $where, $active);

    expect($status(Gate::forUser($user)->inspect('send', $transfer)))->toBe($expected);
})->with([
    'Owner' => ['Owner', 'nowhere', true, 200],
    'Warehouse staff at the source' => ['Warehouse', 'warehouse', true, 200],
    'inactive Warehouse staff at the source' => ['Warehouse', 'warehouse', false, 403],
    'Commissary staff' => ['Commissary', 'commissary', true, 403],
    'Branch lead of the requesting café' => ['Branch lead', 'café', true, 403],
]);

test('the location that asked receives and cancels it', function (string $role, string $where, int $expected) use ($status) {
    $this->seed(RoleSeeder::class);
    [$transfer, $user] = transferAnd($role, $where);

    expect($status(Gate::forUser($user)->inspect('receive', $transfer)))->toBe($expected);
})->with([
    'Owner' => ['Owner', 'nowhere', 200],
    'Branch lead of the café' => ['Branch lead', 'café', 200],
    'Cashier at the café' => ['Cashier', 'café', 403],
    'Branch lead of another café' => ['Branch lead', 'another café', 404],
    'Warehouse staff at the source' => ['Warehouse', 'warehouse', 404],
]);

test('either end can flag an issue on a line', function (string $role, string $where, bool $allowed) {
    $this->seed(RoleSeeder::class);
    [$transfer, $user] = transferAnd($role, $where);

    expect(Gate::forUser($user)->allows('flag', $transfer))->toBe($allowed);
})->with([
    'Warehouse staff at the source' => ['Warehouse', 'warehouse', true],
    'Branch lead of the café' => ['Branch lead', 'café', true],
    'Commissary staff' => ['Commissary', 'commissary', false],
]);
