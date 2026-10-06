<?php

namespace App\Policies;

use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * The client map's legend (client types and their colors) is the Owner's.
 */
class ClientTypePolicy
{
    use ManagesBranches;

    public function manage(User $user): Response
    {
        return $this->ownerOnly($user);
    }
}
