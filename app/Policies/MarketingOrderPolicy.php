<?php

namespace App\Policies;

use App\Models\MarketingOrder;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * A branch answers only its own marketing orders. Another branch's order answers 404.
 */
class MarketingOrderPolicy
{
    /**
     * Accept or decline the order from the branch's till inbox.
     */
    public function respond(User $user, MarketingOrder $marketingOrder): Response
    {
        return $user->branch_id === $marketingOrder->branch_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
