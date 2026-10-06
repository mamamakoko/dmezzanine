<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * Till staff only work on their own branch's orders. Another branch's order answers 404, so the
 * till doesn't learn that it exists.
 */
class OrderPolicy
{
    use ManagesBranches;

    /**
     * Whether the user can refund the sale. A manager's PIN is still needed to approve it (RefundService).
     */
    public function refund(User $user, Order $order): Response
    {
        return $this->manageBranch($user, $order->branch_id);
    }

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
