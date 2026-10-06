<?php

namespace App\Services;

use App\Enums\DrinkSize;
use App\Enums\Milk;
use App\Enums\OrderService;
use App\Enums\OrderSource;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethodKind;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Takes orders and payments at a branch till. Prices always come from the menu, never from the request,
 * and each order is saved in one transaction with the branch row locked, so two tills can't take the
 * same order number or the same open ticket.
 */
class TillCheckout
{
    /**
     * Ticket numbers run 01–25 at each branch, then recycle.
     */
    public const TICKETS = 25;

    /**
     * Take an order. A till order is paid (or put on a tab) now; a Branch Menu order, or a marketing order
     * the branch accepted, goes on the queue unpaid for the cashier to settle.
     *
     * @param  array{service: string, ticket: int, note?: ?string, senior?: bool, lines: list<array{menu_item_id: int, qty: int, size?: ?string, milk?: ?string, addon_ids?: ?list<int>}>, split?: bool, payment_method_id?: ?int, tendered?: ?string, tab_name?: ?string, parts?: ?list<array{payment_method_id: int, amount: string}>}  $data
     */
    public function placeOrder(Branch $branch, User $staff, array $data, OrderSource $source): Order
    {
        return DB::transaction(function () use ($branch, $staff, $data, $source) {
            $branch = Branch::whereKey($branch->id)->lockForUpdate()->firstOrFail();

            $this->ensureTicketIsFree($branch, $data['ticket']);

            $lines = $this->priceLines($branch, $data['lines']);
            $senior = $source === OrderSource::Till && ($data['senior'] ?? false);
            $totals = OrderTotals::fromGross(array_sum(array_column($lines, 'line_total')), $senior);

            $payment = $source === OrderSource::Till
                ? $this->resolvePayment($branch, $staff, $totals->total, $data, allowTab: true)
                : ['payments' => [], 'tab' => null];
            $unpaid = $source !== OrderSource::Till || $payment['tab'] !== null;

            $branch->increment('last_order_no');

            $order = $branch->orders()->create([
                'no' => $branch->last_order_no,
                'ticket' => $data['ticket'],
                'service' => OrderService::from($data['service']),
                'source' => $source,
                'status' => OrderStatus::Preparing,
                'cashier_id' => $staff->id,
                ...$totals->toAttributes(),
                'senior' => $senior,
                'unpaid' => $unpaid,
                'tab_name' => $payment['tab']['name'] ?? null,
                'tab_payment_method_id' => $payment['tab']['method']->id ?? null,
                'note' => filled($data['note'] ?? null) ? trim($data['note']) : null,
                'paid_at' => $unpaid ? null : now(),
            ]);

            foreach ($lines as $line) {
                $addons = $line['addons'];
                unset($line['addons']);

                $orderLine = $order->lines()->create([
                    ...$line,
                    'unit_price' => OrderTotals::pesos($line['unit_price']),
                    'extras' => OrderTotals::pesos($line['extras']),
                    'line_total' => OrderTotals::pesos($line['line_total']),
                ]);
                $orderLine->addons()->createMany($addons);
            }

            $order->payments()->createMany($payment['payments']);

            return $order;
        });
    }

    /**
     * Take payment for an order that was sent unpaid or put on a tab. The cashier can still apply the
     * senior/PWD discount, which recalculates the totals.
     *
     * @param  array{senior?: bool, split?: bool, payment_method_id?: ?int, tendered?: ?string, tab_name?: ?string, parts?: ?list<array{payment_method_id: int, amount: string}>}  $data
     */
    public function settle(Order $order, User $staff, array $data): Order
    {
        return DB::transaction(function () use ($order, $staff, $data) {
            $order = Order::whereKey($order->id)->lockForUpdate()->firstOrFail();

            if (! $order->unpaid) {
                throw ValidationException::withMessages(['order' => "Order #{$order->no} is already paid."]);
            }

            $senior = $data['senior'] ?? false;
            $totals = OrderTotals::fromGross(OrderTotals::centavos($order->gross), $senior);
            $payment = $this->resolvePayment($order->branch, $staff, $totals->total, $data, allowTab: false);

            $order->update([
                ...$totals->toAttributes(),
                'senior' => $senior,
                'unpaid' => false,
                'paid_at' => now(),
                'settled_by_id' => $staff->id,
            ]);
            $order->payments()->createMany($payment['payments']);

            return $order;
        });
    }

    /**
     * A ticket can't be reused while its order is still open.
     */
    private function ensureTicketIsFree(Branch $branch, int $ticket): void
    {
        if ($branch->orders()->holdingTicket()->where('ticket', $ticket)->exists()) {
            throw ValidationException::withMessages([
                'ticket' => sprintf('Ticket %02d is still open. Pick another ticket.', $ticket),
            ]);
        }
    }

    /**
     * Price each line from this branch's menu. Only available items, and only the add-ons the item offers
     * that are switched on at this branch, can be ordered. Amounts are in centavos.
     *
     * @param  list<array{menu_item_id: int, qty: int, size?: ?string, milk?: ?string, addon_ids?: ?list<int>}>  $lines
     * @return list<array{menu_item_id: int, name: string, size: ?DrinkSize, milk: ?Milk, unit_price: int, extras: int, qty: int, line_total: int, addons: list<array{addon_id: int, name: string, price: string}>}>
     */
    private function priceLines(Branch $branch, array $lines): array
    {
        /** @var Collection<int, BranchMenuItem> $entries */
        $entries = $branch->menuEntries()
            ->where('available', true)
            ->whereIn('menu_item_id', array_column($lines, 'menu_item_id'))
            ->with('menuItem.addons')
            ->get()
            ->keyBy('menu_item_id');
        $addonsOffHere = $branch->disabledAddons()->pluck('addons.id')->all();

        $priced = [];

        foreach ($lines as $index => $line) {
            $item = $entries->get($line['menu_item_id'])?->menuItem;

            if ($item === null) {
                throw ValidationException::withMessages([
                    "lines.{$index}.menu_item_id" => 'An item in this order is no longer on the menu here.',
                ]);
            }

            $addonIds = $line['addon_ids'] ?? [];
            $addons = $item->addons->whereIn('id', $addonIds)->whereNotIn('id', $addonsOffHere);

            if (! $item->has_modifiers && $addonIds !== []) {
                throw ValidationException::withMessages(["lines.{$index}.addon_ids" => "{$item->name} doesn't take add-ons."]);
            }

            if ($addons->count() !== count($addonIds)) {
                throw ValidationException::withMessages(["lines.{$index}.addon_ids" => "An add-on on {$item->name} isn't available here."]);
            }

            $size = $item->has_modifiers ? DrinkSize::from($line['size'] ?? DrinkSize::Regular->value) : null;
            $milk = $item->has_modifiers ? Milk::from($line['milk'] ?? Milk::Fresh->value) : null;

            $unitPrice = OrderTotals::centavos($item->price);
            $extras = (($size?->price() ?? 0) + ($milk?->price() ?? 0)) * 100
                + $addons->sum(fn ($addon) => OrderTotals::centavos($addon->price));

            $priced[] = [
                'menu_item_id' => $item->id,
                'name' => $item->name,
                'size' => $size,
                'milk' => $milk,
                'unit_price' => $unitPrice,
                'extras' => $extras,
                'qty' => $line['qty'],
                'line_total' => ($unitPrice + $extras) * $line['qty'],
                'addons' => $addons->map(fn ($addon) => [
                    'addon_id' => $addon->id,
                    'name' => $addon->name,
                    'price' => $addon->price,
                ])->values()->all(),
            ];
        }

        return $priced;
    }

    /**
     * Check the payment against the branch's payment methods and turn it into order_payments rows.
     * A tab records who it is charged to and no payment; it is paid when the order is settled.
     *
     * @param  array{split?: bool, payment_method_id?: ?int, tendered?: ?string, tab_name?: ?string, parts?: ?list<array{payment_method_id: int, amount: string}>}  $data
     * @return array{payments: list<array<string, mixed>>, tab: ?array{method: PaymentMethod, name: string}}
     */
    private function resolvePayment(Branch $branch, User $staff, int $due, array $data, bool $allowTab): array
    {
        $methods = $branch->paymentMethods()->where('active', true)->get()->keyBy('id');

        if ($data['split'] ?? false) {
            return ['payments' => $this->splitPayments($methods, $due, $data['parts'] ?? []), 'tab' => null];
        }

        $method = $methods->get($data['payment_method_id'] ?? null);

        if ($method === null) {
            throw ValidationException::withMessages(['payment_method_id' => "That payment method isn't on at this branch."]);
        }

        if ($method->kind === PaymentMethodKind::Tab) {
            if (! $allowTab) {
                throw ValidationException::withMessages(['payment_method_id' => "A tab can't be used to settle an order."]);
            }

            return ['payments' => [], 'tab' => ['method' => $method, 'name' => $this->checkTab($method, $staff, $due, $data['tab_name'] ?? null)]];
        }

        if ($method->kind === PaymentMethodKind::Cash) {
            $tendered = OrderTotals::centavos($data['tendered'] ?? 0);

            if ($tendered < $due) {
                throw ValidationException::withMessages(['tendered' => 'Cash tendered is less than the amount due.']);
            }

            return ['payments' => [$this->paymentRow($method, $due, $tendered)], 'tab' => null];
        }

        return ['payments' => [$this->paymentRow($method, $due)], 'tab' => null];
    }

    /**
     * Who the tab is charged to, once the method's lead-only rule and limit allow it.
     */
    private function checkTab(PaymentMethod $method, User $staff, int $due, ?string $tabName): string
    {
        $tabName = trim((string) $tabName);

        if ($tabName === '') {
            throw ValidationException::withMessages(['tab_name' => 'Enter who the tab is charged to.']);
        }

        if ($method->lead_only && ! $staff->isBranchLeadOrOwner()) {
            throw ValidationException::withMessages(['payment_method_id' => "Only a Branch lead or the Owner can open a {$method->name} tab."]);
        }

        $limit = OrderTotals::centavos($method->tab_limit);

        if ($limit > 0 && $due > $limit) {
            throw ValidationException::withMessages(['payment_method_id' => 'Over the '.OrderTotals::format($limit)." limit for {$method->name}."]);
        }

        return $tabName;
    }

    /**
     * A split uses only methods that can be split. The parts must cover the amount due, and any
     * overpayment must be cash, because the change comes off the cash part.
     *
     * @param  Collection<int, PaymentMethod>  $methods
     * @param  list<array{payment_method_id: int, amount: string}>  $parts
     * @return list<array<string, mixed>>
     */
    private function splitPayments(Collection $methods, int $due, array $parts): array
    {
        $resolved = [];

        foreach ($parts as $part) {
            $method = $methods->get($part['payment_method_id']);

            if ($method === null) {
                throw ValidationException::withMessages(['parts' => "A payment method in the split isn't on at this branch."]);
            }

            if (! $method->split || $method->kind === PaymentMethodKind::Tab) {
                throw ValidationException::withMessages(['parts' => "{$method->name} can't be part of a split payment."]);
            }

            $resolved[] = ['method' => $method, 'amount' => OrderTotals::centavos($part['amount'])];
        }

        $paid = array_sum(array_column($resolved, 'amount'));

        if ($paid < $due) {
            throw ValidationException::withMessages(['parts' => 'Split is short by '.OrderTotals::format($due - $paid).'.']);
        }

        $isCash = fn (array $part) => $part['method']->kind === PaymentMethodKind::Cash;
        $nonCash = array_sum(array_column(array_filter($resolved, fn (array $part) => ! $isCash($part)), 'amount'));

        if ($paid > $due && $nonCash === $paid) {
            throw ValidationException::withMessages(['parts' => 'Overpayment needs a cash payment to give change from.']);
        }

        if ($nonCash > $due) {
            throw ValidationException::withMessages(['parts' => 'Only the cash part can go over the amount due.']);
        }

        $change = $paid - $due;

        return array_map(function (array $part) use ($isCash, &$change) {
            if (! $isCash($part)) {
                return $this->paymentRow($part['method'], $part['amount']);
            }

            $changeHere = min($change, $part['amount']);
            $change -= $changeHere;

            return $this->paymentRow($part['method'], $part['amount'] - $changeHere, $part['amount']);
        }, $resolved);
    }

    /**
     * An order_payments row. Cash records what was tendered and the change.
     *
     * @return array<string, mixed>
     */
    private function paymentRow(PaymentMethod $method, int $amount, ?int $tendered = null): array
    {
        return [
            'payment_method_id' => $method->id,
            'method_name' => $method->name,
            'kind' => $method->kind,
            'amount' => OrderTotals::pesos($amount),
            'tendered' => $tendered === null ? null : OrderTotals::pesos($tendered),
            'change' => OrderTotals::pesos($tendered === null ? 0 : $tendered - $amount),
        ];
    }
}
