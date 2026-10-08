<?php

namespace App\Policies;

use App\Models\Transfer;
use App\Models\User;
use App\Policies\Concerns\ManagesBranches;
use Illuminate\Auth\Access\Response;

/**
 * The location asked for stock approves, rejects and issues a transfer; the location receiving it cancels
 * its own request and receives it. Either end can flag an issue on a line.
 */
class TransferPolicy
{
    use ManagesBranches;

    public function send(User $user, Transfer $transfer): Response
    {
        return $this->manageLocation($user, $transfer->from);
    }

    public function receive(User $user, Transfer $transfer): Response
    {
        return $this->manageLocation($user, $transfer->to);
    }

    public function flag(User $user, Transfer $transfer): Response
    {
        $sender = $this->manageLocation($user, $transfer->from);

        return $sender->allowed() ? $sender : $this->manageLocation($user, $transfer->to);
    }
}
