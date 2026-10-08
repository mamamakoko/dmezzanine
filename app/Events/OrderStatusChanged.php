<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * An order joined the branch's queue board, moved along it (Preparing → Ready → Served) or was paid.
 * The branch's tills reload their queue and which tickets are taken. It carries no prices.
 */
class OrderStatusChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $branchId, public int $orderId, public string $status) {}

    public static function for(Order $order): self
    {
        return new self($order->branch_id, $order->id, $order->status->value);
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("branch.{$this->branchId}")];
    }

    public function broadcastAs(): string
    {
        return 'OrderStatusChanged';
    }
}
