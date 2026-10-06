<?php

namespace App\Policies;

use App\Models\Addon;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * The add-on list, prices, ingredients and which items offer each add-on are the Owner's. A branch only
 * switches an add-on on or off for itself (BranchPolicy::manage).
 */
class AddonPolicy
{
    use ManagesBranches;

    public function create(User $user): Response
    {
        return $this->ownerOnly($user);
    }

    public function update(User $user, Addon $addon): Response
    {
        return $this->ownerOnly($user);
    }

    public function delete(User $user, Addon $addon): Response
    {
        return $this->ownerOnly($user);
    }
}
