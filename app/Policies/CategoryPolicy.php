<?php

namespace App\Policies;

use App\Models\Category;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * Categories belong to one branch's menu.
 */
class CategoryPolicy
{
    use ManagesBranches;

    public function update(User $user, Category $category): Response
    {
        return $this->manageBranch($user, $category->branch_id);
    }

    public function delete(User $user, Category $category): Response
    {
        return $this->manageBranch($user, $category->branch_id);
    }
}
