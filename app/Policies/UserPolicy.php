<?php

namespace App\Policies;

use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Accounts on the Owner console. Anyone with the Owner console open can manage staff accounts, but only
 * the Owner changes an Owner's account or makes someone an Owner, and no one switches off their own access.
 */
class UserPolicy
{
    /**
     * Edit the user's name, role and location, or issue a new password or PIN.
     */
    public function update(User $user, User $model): Response
    {
        if ($model->isOwner() && ! $user->isOwner()) {
            return Response::deny("Only the Owner can change the Owner's account.");
        }

        return Response::allow();
    }

    /**
     * Grant or revoke the user's access.
     */
    public function toggleAccess(User $user, User $model): Response
    {
        if ($user->is($model)) {
            return Response::deny("You can't switch off your own access.");
        }

        return $this->update($user, $model);
    }

    /**
     * Change which pages the user can open. The Owner keeps every page, including the Owner console.
     */
    public function changePages(User $user, User $model): Response
    {
        if ($model->isOwner()) {
            return Response::deny('The Owner always has every page.');
        }

        return Response::allow();
    }

    /**
     * Give someone the Owner role.
     */
    public function makeOwner(User $user): Response
    {
        return $user->isOwner()
            ? Response::allow()
            : Response::deny('Only the Owner can make someone an Owner.');
    }
}
