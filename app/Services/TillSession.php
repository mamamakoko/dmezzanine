<?php

namespace App\Services;

use App\Enums\PermissionArea;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Who is working the till in this browser. A PIN unlock (PosUnlockController) stores the branch and the
 * staff member in the session; the till stays unlocked for them until someone exits.
 */
class TillSession
{
    public function __construct(private Request $request) {}

    /**
     * The staff member the till is unlocked for, or null when it is locked. The unlock only counts for the
     * signed-in account's branch, and only while the staff member can still use the till.
     */
    public function staff(): ?User
    {
        $till = $this->request->session()->get('pos');
        $branchId = $this->request->user()?->branch_id;

        if (! is_array($till) || $branchId === null || $till['branch_id'] !== $branchId) {
            return null;
        }

        $staff = User::with(['role.permissions', 'permissionOverrides'])->find($till['staff_id']);

        return $staff?->canAccess(PermissionArea::Pos) ? $staff : null;
    }

    /**
     * Lock the till so the next person has to enter their PIN.
     */
    public function lock(): void
    {
        $this->request->session()->forget('pos');
    }
}
