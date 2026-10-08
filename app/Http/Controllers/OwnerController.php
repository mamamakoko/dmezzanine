<?php

namespace App\Http\Controllers;

use App\Enums\BranchStatus;
use App\Enums\PermissionArea;
use App\Models\Branch;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\User;
use App\Services\ActivityFeed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Owner console: users and their access, per-user page access, locations and the activity log.
 */
class OwnerController extends Controller
{
    public const SCREENS = ['users', 'pages', 'locations', 'log'];

    public function show(Request $request, ActivityFeed $feed): Response
    {
        $screen = in_array($request->query('screen'), self::SCREENS, true) ? $request->query('screen') : 'users';
        $date = fn (string $key) => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $request->query($key)) ? $request->query($key) : null;

        return Inertia::render('owner', [
            'screen' => $screen,
            'users' => $this->users(),
            'roles' => Role::with('permissions')->orderBy('id')->get()->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'areas' => $role->permissions->filter(fn (RolePermission $permission) => $permission->allowed)
                    ->map(fn (RolePermission $permission) => $permission->area->value)->values()->all(),
            ])->all(),
            'locations' => $this->locations(),
            'log' => $screen === 'log' ? [
                'from' => $date('from'),
                'to' => $date('to'),
                'entries' => $feed->entries($date('from'), $date('to')),
                'limit' => ActivityFeed::LIMIT,
            ] : null,
            'issued' => $request->session()->get('issued'),
            'canMakeOwner' => Gate::allows('makeOwner', User::class),
        ]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function users(): array
    {
        return User::with(['role.permissions', 'branch', 'permissionOverrides'])
            ->orderByDesc('active')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role_id' => $user->role_id,
                'role' => $user->role->name,
                'is_owner' => $user->isOwner(),
                'branch_id' => $user->branch_id,
                'location' => $user->branch?->name ?? 'All locations',
                'active' => $user->active,
                'pending' => $user->isInvitePending(),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'has_pin' => $user->pin_hash !== null,
                'areas' => array_map(fn (PermissionArea $area) => $area->value, $user->grantedAreas()),
            ])
            ->all();
    }

    /**
     * Every location with its manager, staff and how many items it tracks.
     *
     * @return list<array<string, mixed>>
     */
    private function locations(): array
    {
        return Branch::with('manager')
            ->withCount(['stockItems', 'warehouseStock', 'users' => fn ($query) => $query->where('active', true)])
            ->orderByRaw('CASE WHEN status = ? THEN 1 ELSE 0 END', [BranchStatus::Archived->value])
            ->orderBy('id')
            ->get()
            ->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'kind' => $branch->kind->value,
                'address' => $branch->address,
                'status' => $branch->status->value,
                'manager_id' => $branch->manager_id,
                'manager' => $branch->manager?->name,
                'items' => $branch->isCafe() ? $branch->stock_items_count : $branch->warehouse_stock_count,
                'staff' => $branch->users_count,
            ])
            ->all();
    }
}
