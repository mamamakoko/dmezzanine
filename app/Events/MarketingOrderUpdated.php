<?php

namespace App\Events;

use App\Models\MarketingOrder;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A branch accepted or declined a marketing order, or settled one. Marketing reloads its sent orders,
 * and the branch's other tills their inbox. It carries no prices.
 */
class MarketingOrderUpdated implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $branchId, public int $marketingOrderId, public string $status) {}

    public static function for(MarketingOrder $marketingOrder): self
    {
        return new self($marketingOrder->branch_id, $marketingOrder->id, $marketingOrder->status->value);
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('marketing'), new PrivateChannel("branch.{$this->branchId}")];
    }

    public function broadcastAs(): string
    {
        return 'MarketingOrderUpdated';
    }
}
