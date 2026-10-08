<?php

namespace App\Events;

use App\Enums\BranchKind;
use App\Models\Branch;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * The branch's menu changed: an item went on or off the board, a category changed, an add-on was
 * switched, or a shared item or add-on was edited. The branch's tills and Marketing reload the menu.
 */
class MenuAvailabilityChanged implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $branchId) {}

    /**
     * The menu items and add-ons are shared, so a change to one reaches every café branch.
     */
    public static function everywhere(): void
    {
        Branch::where('kind', BranchKind::Branch)->pluck('id')->each(fn (int $branchId) => self::dispatch($branchId));
    }

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("branch.{$this->branchId}"), new PrivateChannel('marketing')];
    }

    public function broadcastAs(): string
    {
        return 'MenuAvailabilityChanged';
    }
}
