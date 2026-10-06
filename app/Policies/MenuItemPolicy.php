<?php

namespace App\Policies;

use App\Models\MenuItem;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * Menu items are shared by every branch (name, price, photo, recipe, add-ons offered), so only the
 * Owner changes them. Branches decide availability and category through BranchMenuItemPolicy.
 */
class MenuItemPolicy
{
    use ManagesBranches;

    public function create(User $user): Response
    {
        return $this->ownerOnly($user);
    }

    public function update(User $user, MenuItem $menuItem): Response
    {
        return $this->ownerOnly($user);
    }
}
