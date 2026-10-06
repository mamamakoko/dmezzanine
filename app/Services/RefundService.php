<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethodKind;
use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Refunds at a branch. A refund is a negative order tied to the sale (refund_of), line by line and per
 * quantity, approved with the PIN of the branch's lead or the Owner.
 */
class RefundService
{
    /**
     * How the money goes back, from the till prototype, with the payment kind each is recorded as.
     */
    public const METHODS = [
        'Cash back' => PaymentMethodKind::Cash,
        'E-wallet reversal' => PaymentMethodKind::Qr,
        'Store credit' => PaymentMethodKind::Other,
    ];

    public const REASONS = ['Wrong order', 'Quality', 'Customer changed mind'];

    /**
     * Refund some of the sale's lines.
     *
     * @param  array{lines: list<array{order_line_id: int, qty: int}>, reason: string, method: string, pin: string}  $data
     */
    public function refund(Order $order, User $staff, array $data): Order
    {
        return DB::transaction(function () use ($order, $staff, $data) {
            $branch = Branch::whereKey($order->branch_id)->lockForUpdate()->firstOrFail();
            $order = Order::with(['lines.refundLines', 'refunds'])->findOrFail($order->id);

            if ($order->isRefund() || $order->unpaid) {
                throw ValidationException::withMessages(['order' => "Order #{$order->no} can't be refunded until it is paid."]);
            }

            $manager = $this->approvingManager($branch, $data['pin']);
            $lines = $this->refundLines($order, $data['lines']);

            $gross = array_sum(array_map(fn (array $line) => $line['gross'], $lines));
            $totals = $this->fullyRefunded($order, $lines)
                ? $this->remainder($order)
                : OrderTotals::fromGross($gross, $order->senior);

            $branch->increment('last_order_no');

            $refund = $branch->orders()->create([
                'no' => $branch->last_order_no,
                'ticket' => null,
                'service' => $order->service,
                'source' => $order->source,
                'status' => OrderStatus::Served,
                'cashier_id' => $staff->id,
                'approved_by_id' => $manager->id,
                'refund_of' => $order->id,
                'refund_reason' => $data['reason'],
                'gross' => OrderTotals::pesos(-$totals->gross),
                'vat_exempt' => OrderTotals::pesos(-$totals->vatExempt),
                'discount' => OrderTotals::pesos(-$totals->discount),
                'vat' => OrderTotals::pesos(-$totals->vat),
                'total' => OrderTotals::pesos(-$totals->total),
                'senior' => $order->senior,
                'unpaid' => false,
                'paid_at' => now(),
            ]);

            foreach ($lines as $line) {
                $refund->lines()->create([
                    'refund_of_line_id' => $line['line']->id,
                    'menu_item_id' => $line['line']->menu_item_id,
                    'name' => $line['line']->name,
                    'size' => $line['line']->size,
                    'milk' => $line['line']->milk,
                    'unit_price' => $line['line']->unit_price,
                    'extras' => $line['line']->extras,
                    'qty' => $line['qty'],
                    'line_total' => OrderTotals::pesos(-$line['gross']),
                ]);
            }

            $refund->payments()->create([
                'method_name' => $data['method'],
                'kind' => self::METHODS[$data['method']],
                'amount' => OrderTotals::pesos(-$totals->total),
            ]);

            return $refund;
        });
    }

    /**
     * The branch's lead, or the Owner, whose PIN this is.
     */
    private function approvingManager(Branch $branch, string $pin): User
    {
        $manager = User::query()
            ->where('active', true)
            ->whereNotNull('pin_hash')
            ->where(fn (Builder $query) => $query
                ->whereHas('role', fn (Builder $role) => $role->where('name', Role::OWNER))
                ->orWhere(fn (Builder $lead) => $lead
                    ->where('branch_id', $branch->id)
                    ->whereHas('role', fn (Builder $role) => $role->where('name', Role::BRANCH_LEAD))))
            ->get()
            ->first(fn (User $user) => Hash::check($pin, $user->pin_hash));

        if ($manager === null) {
            throw ValidationException::withMessages(['pin' => "That isn't a manager's PIN. A Branch lead or the Owner approves refunds."]);
        }

        return $manager;
    }

    /**
     * Check each line against what is left to refund. Gross amounts are in centavos.
     *
     * @param  list<array{order_line_id: int, qty: int}>  $requested
     * @return list<array{line: OrderLine, qty: int, gross: int}>
     */
    private function refundLines(Order $order, array $requested): array
    {
        $lines = [];

        foreach ($requested as $index => $item) {
            $line = $order->lines->firstWhere('id', $item['order_line_id']);

            if ($line === null) {
                throw ValidationException::withMessages(["lines.{$index}.order_line_id" => "That item isn't on order #{$order->no}."]);
            }

            $left = $line->qty - $line->refundLines->sum('qty');

            if ($item['qty'] > $left) {
                throw ValidationException::withMessages([
                    "lines.{$index}.qty" => $left === 0
                        ? "{$line->name} has already been refunded."
                        : "Only {$left} of {$line->name} can still be refunded.",
                ]);
            }

            $lines[] = [
                'line' => $line,
                'qty' => $item['qty'],
                'gross' => intdiv(OrderTotals::centavos($line->line_total), $line->qty) * $item['qty'],
            ];
        }

        return $lines;
    }

    /**
     * Whether this refund gives back everything that is left on the sale.
     *
     * @param  list<array{line: OrderLine, qty: int, gross: int}>  $refunding
     */
    private function fullyRefunded(Order $order, array $refunding): bool
    {
        return $order->lines->every(function (OrderLine $line) use ($refunding) {
            $now = array_sum(array_map(fn (array $item) => $item['line']->id === $line->id ? $item['qty'] : 0, $refunding));

            return $line->refundLines->sum('qty') + $now >= $line->qty;
        });
    }

    /**
     * What is left of the sale's totals after earlier refunds, so a sale refunded in parts gives back
     * exactly what was paid.
     */
    private function remainder(Order $order): OrderTotals
    {
        $left = fn (string $field) => OrderTotals::centavos($order->{$field})
            + $order->refunds->sum(fn (Order $refund) => OrderTotals::centavos($refund->{$field}));

        return new OrderTotals($left('gross'), $left('vat_exempt'), $left('discount'), $left('vat'), $left('total'));
    }
}
