<?php

namespace App\Policies;

use App\Models\PaymentMethod;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * Payment methods belong to one branch; its lead or the Owner changes them.
 */
class PaymentMethodPolicy
{
    use ManagesBranches;

    public function update(User $user, PaymentMethod $paymentMethod): Response
    {
        return $this->manageBranch($user, $paymentMethod->branch_id);
    }

    public function delete(User $user, PaymentMethod $paymentMethod): Response
    {
        return $this->manageBranch($user, $paymentMethod->branch_id);
    }
}
