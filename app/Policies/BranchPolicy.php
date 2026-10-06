<?php

namespace App\Policies;

use App\Models\Branch;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

class BranchPolicy
{
    use ManagesBranches;

    /**
     * Open the branch's back office and change what belongs to the branch: its menu, categories,
     * add-on switches and payment methods, and refunds.
     */
    public function manage(User $user, Branch $branch): Response
    {
        return $this->manageBranch($user, $branch->id);
    }
}
