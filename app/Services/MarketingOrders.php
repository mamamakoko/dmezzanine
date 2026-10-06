<?php

namespace App\Services;

use App\Enums\MarketingOrderStatus;
use App\Enums\OrderService;
use App\Enums\OrderSource;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\MarketingOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Orders marketing agents send to a branch. They carry no prices: the branch accepts one from its till's
 * inbox, which prices it from the menu and puts it on the queue unpaid, or declines it with a reply.
 */
class MarketingOrders
{
    public const DECLINE_REPLY = 'cannot take this one — please call the branch';

    public function __construct(private TillCheckout $checkout) {}

    /**
     * Send an order to a branch. Only items available there, and add-ons the item offers that are on at
     * the branch, can be ordered.
     *
     * @param  array{branch_id: int, service: string, customer: string, phone?: ?string, address?: ?string, wanted_on: string, wanted_at?: ?string, note?: ?string, lines: list<array{menu_item_id: int, qty: int, addon_ids?: ?list<int>}>}  $data
     */
    public function send(User $agent, array $data): MarketingOrder
    {
        $branch = Branch::findOrFail($data['branch_id']);
        $lines = $this->checkLines($branch, $data['lines']);

        return DB::transaction(function () use ($agent, $branch, $data, $lines) {
            $order = $branch->marketingOrders()->create([
                'agent_id' => $agent->id,
                'service' => $data['service'],
                'customer' => trim($data['customer']),
                'phone' => $data['phone'] ?? null,
                'address' => $data['address'] ?? null,
                'wanted_on' => $data['wanted_on'],
                'wanted_at' => $data['wanted_at'] ?? null,
                'note' => $data['note'] ?? null,
                'status' => MarketingOrderStatus::Sent,
            ]);
            $order->lines()->createMany($lines);

            return $order;
        });
    }

    /**
     * Accept the order at the till: it is priced from the menu and joins the queue unpaid on the first
     * free ticket. Settling it later (Take payment) records it as a paid sale.
     */
    public function accept(MarketingOrder $marketingOrder, User $staff): MarketingOrder
    {
        return DB::transaction(function () use ($marketingOrder, $staff) {
            $marketingOrder = MarketingOrder::with(['lines', 'branch'])->lockForUpdate()->findOrFail($marketingOrder->id);
            $this->ensureWaiting($marketingOrder);
            $branch = $marketingOrder->branch;
            $ticket = $this->firstFreeTicket($branch);

            $order = $this->checkout->placeOrder($branch, $staff, [
                'service' => OrderService::Takeout->value,
                'ticket' => $ticket,
                'note' => Str::limit(collect([
                    $marketingOrder->number(),
                    $marketingOrder->customer,
                    'needed '.$marketingOrder->wantedLabel(),
                    $marketingOrder->note,
                ])->filter()->implode(' · '), 250),
                'lines' => $marketingOrder->lines->map(fn ($line) => [
                    'menu_item_id' => $line->menu_item_id,
                    'qty' => $line->qty,
                    'addon_ids' => array_column($line->addons, 'id'),
                ])->all(),
            ], OrderSource::Marketing);

            $marketingOrder->update([
                'status' => MarketingOrderStatus::Accepted,
                'order_id' => $order->id,
                'replied_by_id' => $staff->id,
                'reply' => sprintf('accepted it · ticket %02d', $ticket),
                'replied_at' => now(),
            ]);

            return $marketingOrder;
        });
    }

    /**
     * Decline the order. The agent sees the reply on their sent orders.
     */
    public function decline(MarketingOrder $marketingOrder, User $staff, ?string $reply): MarketingOrder
    {
        return DB::transaction(function () use ($marketingOrder, $staff, $reply) {
            $marketingOrder = MarketingOrder::lockForUpdate()->findOrFail($marketingOrder->id);
            $this->ensureWaiting($marketingOrder);

            $marketingOrder->update([
                'status' => MarketingOrderStatus::Declined,
                'replied_by_id' => $staff->id,
                'reply' => filled($reply) ? trim($reply) : self::DECLINE_REPLY,
                'replied_at' => now(),
            ]);

            return $marketingOrder;
        });
    }

    private function ensureWaiting(MarketingOrder $marketingOrder): void
    {
        if ($marketingOrder->status !== MarketingOrderStatus::Sent) {
            throw ValidationException::withMessages([
                'marketing_order' => "{$marketingOrder->number()} has already been {$marketingOrder->status->value}.",
            ]);
        }
    }

    private function firstFreeTicket(Branch $branch): int
    {
        $open = $branch->orders()->holdingTicket()->pluck('ticket')->all();

        foreach (range(1, TillCheckout::TICKETS) as $ticket) {
            if (! in_array($ticket, $open, true)) {
                return $ticket;
            }
        }

        throw ValidationException::withMessages(['marketing_order' => 'Every ticket is open. Serve an order to free one first.']);
    }

    /**
     * @param  list<array{menu_item_id: int, qty: int, addon_ids?: ?list<int>}>  $lines
     * @return list<array{menu_item_id: int, name: string, qty: int, addons: list<array{id: int, name: string}>}>
     */
    private function checkLines(Branch $branch, array $lines): array
    {
        $entries = $branch->menuEntries()
            ->where('available', true)
            ->whereIn('menu_item_id', array_column($lines, 'menu_item_id'))
            ->with('menuItem.addons')
            ->get()
            ->keyBy('menu_item_id');
        $addonsOffHere = $branch->disabledAddons()->pluck('addons.id')->all();

        return array_map(function (array $line, int $index) use ($entries, $addonsOffHere, $branch) {
            /** @var BranchMenuItem|null $entry */
            $entry = $entries->get($line['menu_item_id']);

            if ($entry === null) {
                throw ValidationException::withMessages(["lines.{$index}.menu_item_id" => "An item in this order isn't available at {$branch->name}."]);
            }

            $addonIds = $line['addon_ids'] ?? [];
            $addons = $entry->menuItem->addons->whereIn('id', $addonIds)->whereNotIn('id', $addonsOffHere);

            if ($addons->count() !== count($addonIds)) {
                throw ValidationException::withMessages(["lines.{$index}.addon_ids" => "An add-on on {$entry->menuItem->name} isn't available at {$branch->name}."]);
            }

            return [
                'menu_item_id' => $entry->menu_item_id,
                'name' => $entry->menuItem->name,
                'qty' => $line['qty'],
                'addons' => $addons->map(fn ($addon) => ['id' => $addon->id, 'name' => $addon->name])->values()->all(),
            ];
        }, $lines, array_keys($lines));
    }
}
