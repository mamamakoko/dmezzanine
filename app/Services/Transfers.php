<?php

namespace App\Services;

use App\Enums\IssueReason;
use App\Enums\TransferKind;
use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Delivery;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Stock moving between locations. A requisition is raised by the location that needs stock, approved and
 * issued by the location it asks (issuing takes the stock off that location), then received line by line
 * at the destination (receiving adds it there and logs a delivery). Café branches keep their stock in
 * branch_stock; the warehouse and the commissary in warehouse_stock.
 */
class Transfers
{
    /**
     * Raise a requisition: the destination asks the source for stock it holds.
     *
     * @param  array<int, float>  $lines  quantity by stock item id
     */
    public function requisition(Branch $from, Branch $to, array $lines, User $by): Transfer
    {
        if ($from->isCafe() || $from->id === $to->id) {
            throw ValidationException::withMessages(['from_branch_id' => 'Request stock from the warehouse or the commissary.']);
        }

        $held = $from->warehouseStock()->whereIn('stock_item_id', array_keys($lines))->pluck('stock_item_id');

        if ($held->count() !== count($lines)) {
            throw ValidationException::withMessages(['lines' => "{$from->name} doesn't stock one of those items."]);
        }

        return $this->create(TransferKind::Requisition, $from, $to, $lines, $by, TransferStatus::Requested);
    }

    /**
     * Send a finished batch's stock from the commissary to the warehouse. It is on its way at once.
     */
    public function commissaryOutput(Branch $commissary, Branch $warehouse, StockItem $item, float $qty, User $by): Transfer
    {
        return $this->create(TransferKind::CommissaryOutput, $commissary, $warehouse, [$item->id => $qty], $by, TransferStatus::InTransit);
    }

    public function approve(Transfer $transfer, User $by): void
    {
        $this->ensureStatus($transfer, [TransferStatus::Requested], 'Only a new request can be approved.');

        $transfer->update(['status' => TransferStatus::Approved, 'approved_by_id' => $by->id, 'approved_at' => now()]);
    }

    public function reject(Transfer $transfer, User $by): void
    {
        $this->ensureStatus($transfer, [TransferStatus::Requested], 'Only a new request can be rejected.');

        $transfer->update(['status' => TransferStatus::Rejected, 'closed_by_id' => $by->id, 'closed_at' => now()]);
    }

    /**
     * The requester withdraws the transfer before anything is sent.
     */
    public function cancel(Transfer $transfer, User $by): void
    {
        DB::transaction(function () use ($transfer, $by) {
            $transfer = Transfer::lockForUpdate()->findOrFail($transfer->id);

            if (! $transfer->status->isCancellable()) {
                throw ValidationException::withMessages(['transfer' => "{$transfer->number()} is already on its way. It can't be cancelled now."]);
            }

            $transfer->update(['status' => TransferStatus::Cancelled, 'closed_by_id' => $by->id, 'closed_at' => now()]);
        });
    }

    /**
     * Issue and send an approved transfer: its stock comes off the source, which must hold enough of
     * every line.
     */
    public function issue(Transfer $transfer, User $by): void
    {
        DB::transaction(function () use ($transfer, $by) {
            $transfer = Transfer::with('lines.stockItem')->lockForUpdate()->findOrFail($transfer->id);
            $this->ensureStatus($transfer, [TransferStatus::Approved], 'Approve the request before issuing it.');

            $stock = WarehouseStock::where('branch_id', $transfer->from_branch_id)
                ->whereIn('stock_item_id', $transfer->lines->pluck('stock_item_id'))
                ->lockForUpdate()
                ->get()
                ->keyBy('stock_item_id');

            $short = $transfer->lines->filter(fn (TransferLine $line) => (float) ($stock->get($line->stock_item_id)->on_hand ?? 0) < (float) $line->qty);

            if ($short->isNotEmpty()) {
                throw ValidationException::withMessages(['transfer' => 'Not enough on hand to send '.$short->map(function (TransferLine $line) use ($stock) {
                    $onHand = (float) ($stock->get($line->stock_item_id)->on_hand ?? 0);

                    return "{$line->stockItem->name} ({$this->qty($onHand)} of {$this->qty((float) $line->qty)} {$line->stockItem->unit})";
                })->join(', ').'.']);
            }

            foreach ($transfer->lines as $line) {
                $stock->get($line->stock_item_id)->decrement('on_hand', $line->qty);
            }

            $transfer->update(['status' => TransferStatus::InTransit, 'issued_by_id' => $by->id, 'issued_at' => now()]);
        });
    }

    /**
     * Receive lines that are on their way (one, or all that are left): each adds its stock at the
     * destination, together as one delivery.
     */
    public function receive(Transfer $transfer, User $by, ?TransferLine $only = null): void
    {
        DB::transaction(function () use ($transfer, $by, $only) {
            $transfer = Transfer::with(['lines.stockItem', 'from', 'to'])->lockForUpdate()->findOrFail($transfer->id);

            if (! $transfer->status->isReceivable()) {
                throw ValidationException::withMessages(['transfer' => "{$transfer->number()} hasn't been sent yet."]);
            }

            $lines = $transfer->lines->whereNull('received_at')
                ->when($only, fn (Collection $lines) => $lines->where('id', $only->id));

            if ($lines->isEmpty()) {
                throw ValidationException::withMessages(['transfer' => 'That line is already received.']);
            }

            $delivery = $transfer->to->deliveries()->create([
                'transfer_id' => $transfer->id,
                'source' => $transfer->from->name,
                'received_by_id' => $by->id,
            ]);

            foreach ($lines as $line) {
                $this->takeIn($delivery, $line->stockItem, (float) $line->qty, (float) $line->stockItem->cost, $by);
                $line->update(['received_at' => now(), 'received_by_id' => $by->id]);
            }

            $allIn = $transfer->lines->every(fn (TransferLine $line) => $line->received_at !== null);
            $transfer->update($allIn
                ? ['status' => TransferStatus::Received, 'closed_by_id' => $by->id, 'closed_at' => now()]
                : ['status' => TransferStatus::PartiallyReceived]);
        });
    }

    /**
     * A café takes in a supplier's delivery of one item. The delivered unit cost becomes the item's cost.
     */
    public function receiveFromSupplier(Branch $branch, string $supplier, StockItem $item, float $qty, float $unitCost, User $by): void
    {
        DB::transaction(function () use ($branch, $supplier, $item, $qty, $unitCost, $by) {
            $delivery = $branch->deliveries()->create(['source' => $supplier, 'received_by_id' => $by->id]);
            $this->takeIn($delivery, $item, $qty, $unitCost, $by);
            $item->update(['cost' => $unitCost]);
        });
    }

    /**
     * Flag what went wrong with a line, or change the flag. Stock doesn't change.
     */
    public function flag(TransferLine $line, IssueReason $reason, ?string $note, User $by): void
    {
        if ($line->transfer->status->isClosed()) {
            throw ValidationException::withMessages(['reason' => "{$line->transfer->number()} is closed."]);
        }

        $line->issue()->updateOrCreate([], ['reason' => $reason, 'note' => $note, 'reported_by_id' => $by->id]);
    }

    /**
     * @param  array<int, float>  $lines  quantity by stock item id
     */
    private function create(TransferKind $kind, Branch $from, Branch $to, array $lines, User $by, TransferStatus $status): Transfer
    {
        return DB::transaction(function () use ($kind, $from, $to, $lines, $by, $status) {
            $transfer = Transfer::create([
                'kind' => $kind,
                'from_branch_id' => $from->id,
                'to_branch_id' => $to->id,
                'status' => $status,
                'requested_by_id' => $by->id,
                ...($status === TransferStatus::InTransit ? ['issued_by_id' => $by->id, 'issued_at' => now()] : []),
            ]);

            foreach ($lines as $stockItemId => $qty) {
                $transfer->lines()->create(['stock_item_id' => $stockItemId, 'qty' => $qty]);
            }

            return $transfer;
        });
    }

    /**
     * Add received stock at the delivery's location and record the receipt (the stock report's "In").
     * An item new to a warehouse or commissary starts with half the quantity as its low level.
     */
    private function takeIn(Delivery $delivery, StockItem $item, float $qty, float $unitCost, User $by): void
    {
        $location = $delivery->branch;

        $delivery->receipts()->create([
            'branch_id' => $location->id,
            'stock_item_id' => $item->id,
            'day' => BusinessDay::today(),
            'qty' => $qty,
            'unit_cost' => $unitCost,
            'source' => $delivery->source,
            'received_by_id' => $by->id,
        ]);

        $held = $location->isCafe()
            ? BranchStock::firstOrCreate(['branch_id' => $location->id, 'stock_item_id' => $item->id], ['on_hand' => 0])
            : WarehouseStock::firstOrCreate(
                ['branch_id' => $location->id, 'stock_item_id' => $item->id],
                ['on_hand' => 0, 'par' => max(1, ceil($qty / 2))],
            );

        $held->increment('on_hand', $qty);
    }

    /**
     * @param  list<TransferStatus>  $statuses
     */
    private function ensureStatus(Transfer $transfer, array $statuses, string $message): void
    {
        if (! in_array($transfer->status, $statuses, true)) {
            throw ValidationException::withMessages(['transfer' => $message]);
        }
    }

    private function qty(float $qty): string
    {
        return rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
    }
}
