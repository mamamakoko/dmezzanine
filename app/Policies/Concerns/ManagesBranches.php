<?php

namespace App\Policies\Concerns;

use App\Enums\PermissionArea;
use App\Models\Branch;
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

    /**
     * Stock at a location: a café is run by its lead (or the Owner), as above; the warehouse and the
     * commissary by their own Inventory staff or the Owner. Inventory staff see every location, so another
     * location's record gets a 403 rather than a 404.
     */
    protected function manageLocation(User $user, Branch $location): Response
    {
        if ($location->isCafe()) {
            return $this->manageBranch($user, $location->id);
        }

        if ($user->active && ($user->isOwner() || ($user->branch_id === $location->id && $user->canAccess(PermissionArea::Inventory)))) {
            return Response::allow();
        }

        return Response::deny("Only the Owner or the {$location->name} staff can do this.");
    }

    protected function ownerOnly(User $user): Response
    {
        return $user->active && $user->isOwner()
            ? Response::allow()
            : Response::deny('Only the Owner can change this. It applies to every branch.');
    }
}
