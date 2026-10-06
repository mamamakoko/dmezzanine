<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\StockItem;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * How much stock a branch's sales used, worked out from the orders rather than kept as a running total.
 * Each order counts once, on the day it was paid (a tab or Branch Menu order when it is settled), and
 * refunds don't give stock back: the item was still made.
 *
 * Per order line: the item's recipe × qty, with oat milk replacing fresh milk for "Oat" and fresh milk
 * left out for "No milk", plus each add-on's ingredients × qty.
 */
class UsageService
{
    public const FRESH_MILK_SKU = 'WH-DRY-011';

    public const OAT_MILK_SKU = 'WH-DRY-018';

    /**
     * Stock used by the branch's sales on a business day (Y-m-d).
     *
     * @return array<int, float> quantity by stock item id
     */
    public function forDay(Branch $branch, string $day): array
    {
        return $this->between($branch, ...BusinessDay::bounds($day));
    }

    /**
     * Stock used by the branch's sales in a month (Y-m).
     *
     * @return array<int, float> quantity by stock item id
     */
    public function forMonth(Branch $branch, string $month): array
    {
        return $this->between($branch, ...BusinessDay::monthBounds($month));
    }

    /**
     * @return array<int, float> quantity by stock item id
     */
    public function between(Branch $branch, Carbon $from, Carbon $to): array
    {
        $milk = StockItem::whereIn('sku', [self::FRESH_MILK_SKU, self::OAT_MILK_SKU])->pluck('id', 'sku');
        $fresh = $milk[self::FRESH_MILK_SKU] ?? 0;
        $oat = $milk[self::OAT_MILK_SKU] ?? $fresh;

        $usedItem = 'CASE WHEN recipes.stock_item_id = ? AND order_lines.milk = ? THEN ? ELSE recipes.stock_item_id END';

        $fromRecipes = $this->paidLines($branch, $from, $to)
            ->join('recipes', 'recipes.menu_item_id', '=', 'order_lines.menu_item_id')
            ->whereNot(fn (Builder $query) => $query->where('recipes.stock_item_id', $fresh)->where('order_lines.milk', 'none'))
            ->selectRaw("{$usedItem} as used_item_id, SUM(order_lines.qty * recipes.qty) as used", [$fresh, 'oat', $oat])
            ->groupBy('used_item_id')
            ->pluck('used', 'used_item_id');

        $fromAddons = $this->paidLines($branch, $from, $to)
            ->join('order_line_addons', 'order_line_addons.order_line_id', '=', 'order_lines.id')
            ->join('addon_parts', 'addon_parts.addon_id', '=', 'order_line_addons.addon_id')
            ->selectRaw('addon_parts.stock_item_id as used_item_id, SUM(order_lines.qty * addon_parts.qty) as used')
            ->groupBy('used_item_id')
            ->pluck('used', 'used_item_id');

        $usage = [];

        foreach ([$fromRecipes, $fromAddons] as $part) {
            foreach ($part as $stockItemId => $qty) {
                $usage[(int) $stockItemId] = round(($usage[(int) $stockItemId] ?? 0) + (float) $qty, 3);
            }
        }

        return $usage;
    }

    /**
     * What sold, by item, for the stock report's "Sales by item": quantity and amount, busiest first.
     *
     * @return list<array{name: string, category: ?string, qty: int, amount: float}>
     */
    public function salesByItem(Branch $branch, Carbon $from, Carbon $to): array
    {
        return $this->paidLines($branch, $from, $to)
            ->leftJoin('branch_menu_items', fn ($join) => $join
                ->on('branch_menu_items.menu_item_id', '=', 'order_lines.menu_item_id')
                ->on('branch_menu_items.branch_id', '=', 'orders.branch_id'))
            ->leftJoin('categories', 'categories.id', '=', 'branch_menu_items.category_id')
            ->selectRaw('order_lines.name, MAX(categories.name) as category, SUM(order_lines.qty) as qty, SUM(order_lines.line_total) as amount')
            ->groupBy('order_lines.name')
            ->orderByDesc('qty')
            ->orderBy('order_lines.name')
            ->get()
            ->map(fn (object $row) => ['name' => $row->name, 'category' => $row->category, 'qty' => (int) $row->qty, 'amount' => round((float) $row->amount, 2)])
            ->all();
    }

    /**
     * Lines of the branch's orders paid in the period, leaving out refunds and anything still unpaid.
     */
    private function paidLines(Branch $branch, Carbon $from, Carbon $to): Builder
    {
        return DB::table('order_lines')
            ->join('orders', 'orders.id', '=', 'order_lines.order_id')
            ->where('orders.branch_id', $branch->id)
            ->where('orders.unpaid', false)
            ->whereNull('orders.refund_of')
            ->whereBetween('orders.paid_at', [$from, $to]);
    }
}
