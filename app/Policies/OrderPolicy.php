<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Till staff only work on their own branch's orders. Another branch's order answers 404, so the
 * till doesn't learn that it exists.
 */
class OrderPolicy
{
    /**
     * Whether the user can move the order along the queue board or take payment for it.
     */
    public function update(User $user, Order $order): Response
    {
        return $user->branch_id === $order->branch_id
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
