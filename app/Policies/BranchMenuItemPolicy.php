<?php

namespace App\Policies;

use App\Models\BranchMenuItem;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * An item on one branch's menu: its category there and whether it is on the board.
 */
class BranchMenuItemPolicy
{
    use ManagesBranches;

    public function update(User $user, BranchMenuItem $branchMenuItem): Response
    {
        return $this->manageBranch($user, $branchMenuItem->branch_id);
    }

    public function delete(User $user, BranchMenuItem $branchMenuItem): Response
    {
        return $this->manageBranch($user, $branchMenuItem->branch_id);
    }
}
