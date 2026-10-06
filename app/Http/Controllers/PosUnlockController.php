<?php

namespace App\Http\Controllers;

use App\Enums\PermissionArea;
use App\Http\Requests\PosUnlockRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class PosUnlockController extends Controller
{
    /**
     * Unlock the till for the staff member whose PIN was entered.
     * The PIN is checked against this branch's active till staff and the Owner.
     */
    public function __invoke(PosUnlockRequest $request): RedirectResponse
    {
        $branchId = $request->user()->branch_id;

        if ($branchId === null) {
            throw ValidationException::withMessages(['pin' => 'Your account has no branch, so there is no till to unlock.']);
        }

        $matches = User::query()
            ->where('active', true)
            ->whereNotNull('pin_hash')
            ->where(fn (Builder $query) => $query
                ->where('branch_id', $branchId)
                ->orWhereHas('role', fn (Builder $role) => $role->where('name', Role::OWNER)))
            ->with(['role.permissions', 'permissionOverrides'])
            ->get()
            ->filter(fn (User $staff) => $staff->canAccess(PermissionArea::Pos)
                && Hash::check($request->validated('pin'), $staff->pin_hash));

        if ($matches->isEmpty()) {
            throw ValidationException::withMessages(['pin' => 'PIN not recognised.']);
        }

        if ($matches->count() > 1) {
            throw ValidationException::withMessages(['pin' => 'That PIN belongs to more than one person. Ask the owner to reset it.']);
        }

        $request->session()->put('pos', [
            'branch_id' => $branchId,
            'staff_id' => $matches->sole()->id,
        ]);

        return redirect()->route('pos');
    }
}
