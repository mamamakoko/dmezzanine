<?php

namespace App\Policies\Concerns;

use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Branch-scoped back-office records can be changed by the Owner or that branch's lead. Another branch's
 * record answers 404, so a branch doesn't learn what another has; staff at the branch who aren't its lead
 * get a 403 that says who can.
 */
trait ManagesBranches
{
    protected function manageBranch(User $user, int $branchId): Response
    {
        if ($user->managesBranch($branchId)) {
            return Response::allow();
        }

        if ($user->branch_id !== $branchId) {
            return Response::denyAsNotFound();
        }

        return Response::deny("Only the Owner or this branch's lead can change this.");
    }

    protected function ownerOnly(User $user): Response
    {
        return $user->active && $user->isOwner()
            ? Response::allow()
            : Response::deny('Only the Owner can change this. It applies to every branch.');
    }
}
