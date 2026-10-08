<?php

namespace App\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The Sales page's figures for some branches over a run of business days.
 *
 * A sale counts on the day it was paid. Open tabs count too, on the day they were rung up, so the takings
 * match the till; they appear under their method as "(unpaid)". Refunds are negative orders, so they come
 * off the day they were given back. Branch Menu and marketing orders not yet paid aren't sales yet.
 *
 * Prices include VAT: net of VAT is the gross less its VAT, whether that VAT was charged or, for a
 * senior/PWD sale, exempted. The amount due (collected) is the gross less the exempt VAT and the discount.
 */
class SalesReport
{
    /**
     * @param  list<int>  $branchIds
     * @return array{
     *     totals: array{tx: int, gross: float, total: float, net: float, vat: float, vat_exempt: float, discount: float},
     *     days: list<array{date: string, tx: int, gross: float, total: float, net: float, vat: float, vat_exempt: float, discount: float}>,
     *     branches: list<array{id: int, name: string, tx: int, total: float}>,
     *     categories: list<array{name: string, amount: float}>,
     *     methods: list<array{name: string, amount: float}>,
     *     items: list<array{name: string, category: string, qty: int, amount: float}>
     * }
     */
    public function build(array $branchIds, string $from, string $to): array
    {
        $start = BusinessDay::bounds($from)[0];
        $end = BusinessDay::bounds($to)[1];

        $days = $this->days($branchIds, $start, $end, $from, $to);

        return [
            'totals' => $this->sum($days, ['tx', 'gross', 'total', 'net', 'vat', 'vat_exempt', 'discount']),
            'days' => $days,
            'branches' => $this->branches($branchIds, $start, $end),
            'categories' => $this->categories($branchIds, $start, $end),
            'methods' => $this->methods($branchIds, $start, $end),
            'items' => $this->items($branchIds, $start, $end),
        ];
    }

    /**
     * Each business day in the range up to today, with no gaps, so the trend shows quiet days.
     *
     * @param  list<int>  $branchIds
     * @return list<array{date: string, tx: int, gross: float, total: float, net: float, vat: float, vat_exempt: float, discount: float}>
     */
    private function days(array $branchIds, Carbon $start, Carbon $end, string $from, string $to): array
    {
        $timezone = config('app.business_timezone');
        $last = min($to, BusinessDay::today());
        $days = [];

        for ($day = Carbon::parse($from); $day->toDateString() <= $last; $day->addDay()) {
            $days[$day->toDateString()] = ['date' => $day->toDateString(), 'tx' => 0, 'gross' => 0, 'total' => 0, 'net' => 0, 'vat' => 0, 'vat_exempt' => 0, 'discount' => 0];
        }

        $rows = $this->sales($branchIds, $start, $end)
            ->select(['orders.refund_of', 'orders.gross', 'orders.vat', 'orders.vat_exempt', 'orders.discount', 'orders.total'])
            ->selectRaw($this->recordedAt().' as recorded_at')
            ->cursor();

        foreach ($rows as $row) {
            $date = Carbon::parse($row->recorded_at, config('app.timezone'))->setTimezone($timezone)->toDateString();

            if (! isset($days[$date])) {
                continue;
            }

            $days[$date]['tx'] += $row->refund_of === null ? 1 : 0;
            $days[$date]['gross'] += (float) $row->gross;
            $days[$date]['total'] += (float) $row->total;
            $days[$date]['net'] += (float) $row->gross - (float) $row->vat - (float) $row->vat_exempt;
            $days[$date]['vat'] += (float) $row->vat;
            $days[$date]['vat_exempt'] += (float) $row->vat_exempt;
            $days[$date]['discount'] += (float) $row->discount;
        }

        return array_values(array_map(fn (array $day) => [
            ...$day,
            ...array_map(fn (int|float $amount) => round($amount, 2), array_diff_key($day, ['date' => true, 'tx' => true])),
        ], $days));
    }

    /**
     * Transactions and takings per branch, busiest first.
     *
     * @param  list<int>  $branchIds
     * @return list<array{id: int, name: string, tx: int, total: float}>
     */
    private function branches(array $branchIds, Carbon $start, Carbon $end): array
    {
        return $this->sales($branchIds, $start, $end)
            ->join('branches', 'branches.id', '=', 'orders.branch_id')
            ->selectRaw('branches.id, branches.name, SUM(CASE WHEN orders.refund_of IS NULL THEN 1 ELSE 0 END) as tx, SUM(orders.total) as total')
            ->groupBy('branches.id', 'branches.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn (object $row) => ['id' => (int) $row->id, 'name' => $row->name, 'tx' => (int) $row->tx, 'total' => round((float) $row->total, 2)])
            ->all();
    }

    /**
     * Line totals by the category each item sits in at the branch that sold it. Categories are kept per
     * branch, so the same name at two branches counts as one.
     *
     * @param  list<int>  $branchIds
     * @return list<array{name: string, amount: float}>
     */
    private function categories(array $branchIds, Carbon $start, Carbon $end): array
    {
        return $this->lines($branchIds, $start, $end)
            ->selectRaw("COALESCE(categories.name, 'Uncategorised') as name, SUM(order_lines.line_total) as amount")
            ->groupByRaw("COALESCE(categories.name, 'Uncategorised')")
            ->orderByDesc('amount')
            ->get()
            ->map(fn (object $row) => ['name' => $row->name, 'amount' => round((float) $row->amount, 2)])
            ->all();
    }

    /**
     * What sold, by item name, highest takings first. A refunded quantity comes off the item's count.
     *
     * @param  list<int>  $branchIds
     * @return list<array{name: string, category: string, qty: int, amount: float}>
     */
    private function items(array $branchIds, Carbon $start, Carbon $end): array
    {
        return $this->lines($branchIds, $start, $end)
            ->selectRaw("order_lines.name, COALESCE(MAX(categories.name), 'Uncategorised') as category")
            ->selectRaw('SUM(CASE WHEN orders.refund_of IS NULL THEN order_lines.qty ELSE -order_lines.qty END) as qty')
            ->selectRaw('SUM(order_lines.line_total) as amount')
            ->groupBy('order_lines.name')
            ->orderByDesc('amount')
            ->orderBy('order_lines.name')
            ->get()
            ->map(fn (object $row) => ['name' => $row->name, 'category' => $row->category, 'qty' => (int) $row->qty, 'amount' => round((float) $row->amount, 2)])
            ->all();
    }

    /**
     * Takings by payment method, from each sale's payments: split parts count under their own method,
     * refunds under how the money went back, and open tabs under their method marked "(unpaid)".
     *
     * @param  list<int>  $branchIds
     * @return list<array{name: string, amount: float}>
     */
    private function methods(array $branchIds, Carbon $start, Carbon $end): array
    {
        $paid = $this->sales($branchIds, $start, $end)
            ->join('order_payments', 'order_payments.order_id', '=', 'orders.id')
            ->selectRaw('order_payments.method_name as name, SUM(order_payments.amount) as amount')
            ->groupBy('order_payments.method_name')
            ->get();

        $tabs = $this->sales($branchIds, $start, $end)
            ->where('orders.unpaid', true)
            ->leftJoin('payment_methods', 'payment_methods.id', '=', 'orders.tab_payment_method_id')
            ->selectRaw("COALESCE(payment_methods.name, 'Tab') as name, SUM(orders.total) as amount")
            ->groupByRaw("COALESCE(payment_methods.name, 'Tab')")
            ->get()
            ->map(fn (object $row) => (object) ['name' => "{$row->name} (unpaid)", 'amount' => $row->amount]);

        return $paid->concat($tabs)
            ->map(fn (object $row) => ['name' => $row->name, 'amount' => round((float) $row->amount, 2)])
            ->sortByDesc('amount')
            ->values()
            ->all();
    }

    /**
     * The orders that count as sales in the period: paid orders and refunds by when they were paid, and
     * open tabs by when they were rung up.
     *
     * @param  list<int>  $branchIds
     */
    private function sales(array $branchIds, Carbon $start, Carbon $end): Builder
    {
        return DB::table('orders')
            ->whereIn('orders.branch_id', $branchIds)
            ->where(fn (Builder $query) => $query->where('orders.unpaid', false)->orWhereNotNull('orders.tab_name'))
            ->whereRaw($this->recordedAt().' BETWEEN ? AND ?', [$start, $end]);
    }

    /**
     * The sales' lines, with the category each item sits in at the branch that sold it.
     *
     * @param  list<int>  $branchIds
     */
    private function lines(array $branchIds, Carbon $start, Carbon $end): Builder
    {
        return $this->sales($branchIds, $start, $end)
            ->join('order_lines', 'order_lines.order_id', '=', 'orders.id')
            ->leftJoin('branch_menu_items', fn ($join) => $join
                ->on('branch_menu_items.menu_item_id', '=', 'order_lines.menu_item_id')
                ->on('branch_menu_items.branch_id', '=', 'orders.branch_id'))
            ->leftJoin('categories', 'categories.id', '=', 'branch_menu_items.category_id');
    }

    private function recordedAt(): string
    {
        return 'COALESCE(orders.paid_at, orders.created_at)';
    }

    /**
     * @param  list<array<string, mixed>>  $days
     * @param  list<string>  $keys
     * @return array{tx: int, gross: float, total: float, net: float, vat: float, vat_exempt: float, discount: float}
     */
    private function sum(array $days, array $keys): array
    {
        $totals = [];

        foreach ($keys as $key) {
            $sum = array_sum(array_column($days, $key));
            $totals[$key] = $key === 'tx' ? (int) $sum : round($sum, 2);
        }

        return $totals;
    }
}
