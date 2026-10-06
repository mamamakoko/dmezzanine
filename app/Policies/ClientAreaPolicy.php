<?php

namespace App\Policies;

use App\Models\ClientArea;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * Only the Owner draws areas and assigns their officers.
 */
class ClientAreaPolicy
{
    use ManagesBranches;

    public function create(User $user): Response
    {
        return $this->ownerOnly($user);
    }

    public function update(User $user, ClientArea $clientArea): Response
    {
        return $this->ownerOnly($user);
    }

    public function delete(User $user, ClientArea $clientArea): Response
    {
        return $this->ownerOnly($user);
    }
}
