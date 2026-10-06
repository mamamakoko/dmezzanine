<?php

namespace App\Http\Resources;

use App\Enums\MarketingOrderStatus;
use App\Enums\OrderStatus;
use App\Models\MarketingOrder;
use App\Models\MarketingOrderLine;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A marketing order as the agent and the branch's inbox see it. It never carries prices: marketing
 * doesn't see money, and the till prices the order when it is accepted. Needs branch, agent, repliedBy,
 * order and lines loaded.
 *
 * @mixin MarketingOrder
 */
class MarketingOrderResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no' => $this->number(),
            'branch_id' => $this->branch_id,
            'branch' => $this->branch->name,
            'agent' => $this->agent?->name,
            'service' => $this->service,
            'service_label' => $this->service->label(),
            'customer' => $this->customer,
            'phone' => $this->phone,
            'address' => $this->address,
            'wanted_on' => $this->wanted_on->toDateString(),
            'wanted_at' => $this->wanted_at,
            'wanted' => $this->wantedLabel(),
            'note' => $this->note,
            'status' => $this->status,
            'progress' => $this->progress(),
            'reply' => $this->reply,
            'replied_by' => $this->repliedBy?->name,
            'ticket' => $this->order?->ticket,
            'paid' => $this->order !== null && ! $this->order->unpaid,
            'sent_at' => $this->created_at->toIso8601String(),
            'lines' => $this->lines->map(fn (MarketingOrderLine $line) => [
                'menu_item_id' => $line->menu_item_id,
                'name' => $line->name,
                'qty' => $line->qty,
                'addons' => $line->addons,
            ])->all(),
        ];
    }

    /**
     * Where the order is, for the agent: Sent or Declined, and once accepted the till order's status.
     */
    private function progress(): string
    {
        if ($this->status !== MarketingOrderStatus::Accepted || $this->order === null) {
            return ucfirst($this->status->value);
        }

        return match ($this->order->status) {
            OrderStatus::Preparing => 'Preparing',
            OrderStatus::Ready => 'Ready',
            OrderStatus::Served => 'Served',
        };
    }
}
