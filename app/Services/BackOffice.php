<?php

namespace App\Services;

use App\Enums\BranchKind;
use App\Http\Resources\TransferResource;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OrderPayment;
use App\Models\PaymentMethod;
use App\Models\PaymentMethodLog;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * The data behind the till's back-office tabs. Only the open tab's data is built.
 */
class BackOffice
{
    public const TABS = ['dash', 'menu', 'addons', 'payments', 'stock', 'stockin', 'sales'];

    /**
     * The sales list shows at most this many receipts, newest first.
     */
    public const SALES_LIMIT = 300;

    /**
     * Stock-in shows the branch's latest transfers, up to this many.
     */
    public const TRANSFERS_LIMIT = 150;

    /**
     * What TransferResource needs loaded.
     *
     * @var list<string>
     */
    public const TRANSFER_RELATIONS = ['from', 'to', 'requestedBy', 'lines.stockItem', 'lines.issue'];

    /**
     * Units offered when a delivery brings in an item no location has stocked before.
     *
     * @var list<string>
     */
    public const UNITS = ['pc', 'g', 'kg', 'ml', 'L', 'btl', 'can', 'pack', 'box', 'tray', 'sachet', 'slice'];

    /**
     * @param  array{from?: ?string, to?: ?string}  $filters
     * @return array<string, mixed>
     */
    public function props(Branch $branch, User $staff, string $tab, array $filters): array
    {
        return [
            'tab' => $tab,
            'isOwner' => $staff->isOwner(),
            'lowCount' => $this->stock($branch)->filter(fn (array $item) => $item['low'])->count(),
            'incomingCount' => $branch->transfersIn()->incoming()->count(),
            ...match ($tab) {
                'dash' => $this->dashboard($branch),
                'menu' => $this->menu($branch),
                'addons' => $this->addons($branch),
                'payments' => $this->paymentMethods($branch),
                'stock' => ['stock' => $this->stock($branch)->values()->all()],
                'stockin' => $this->stockIn($branch),
                'sales' => $this->sales($branch, $filters),
            },
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function dashboard(Branch $branch): array
    {
        [$start, $end] = BusinessDay::bounds(BusinessDay::today());
        $today = $branch->orders()->whereNull('refund_of')->where('unpaid', false)->whereBetween('created_at', [$start, $end]);

        return [
            'stock' => $this->stock($branch)->sortBy(fn (array $item) => $item['par'] > 0 ? $item['on_hand'] / $item['par'] : 1)->values()->all(),
            'salesToday' => ['total' => (float) (clone $today)->sum('total'), 'count' => $today->count()],
            'unpaid' => $this->unpaidOrders($branch),
            'incoming' => TransferResource::collection(
                $branch->transfersIn()->incoming()->with(self::TRANSFER_RELATIONS)->latest('id')->get(),
            )->resolve(),
        ];
    }

    /**
     * Stock-in: supplier deliveries, and transfers into and out of the branch, with what the warehouse and
     * the commissary hold for a requisition.
     *
     * @return array<string, mixed>
     */
    private function stockIn(Branch $branch): array
    {
        return [
            'stock' => $this->stock($branch)->values()->all(),
            'categories' => StockItem::distinct()->orderBy('category')->pluck('category')->all(),
            'units' => self::UNITS,
            'transfers' => TransferResource::collection(
                Transfer::where(fn ($query) => $query->where('from_branch_id', $branch->id)->orWhere('to_branch_id', $branch->id))
                    ->with(self::TRANSFER_RELATIONS)
                    ->latest('id')
                    ->limit(self::TRANSFERS_LIMIT)
                    ->get(),
            )->resolve(),
            'sources' => Branch::where('kind', '!=', BranchKind::Branch)->orderBy('id')
                ->with(['warehouseStock.stockItem'])
                ->get()
                ->map(fn (Branch $source) => [
                    'id' => $source->id,
                    'name' => $source->name,
                    'items' => $source->warehouseStock->sortBy('stockItem.name')->map(fn (WarehouseStock $held) => [
                        'id' => $held->stock_item_id,
                        'sku' => $held->stockItem->sku,
                        'name' => $held->stockItem->name,
                        'category' => $held->stockItem->category,
                        'unit' => $held->stockItem->unit,
                        'on_hand' => (float) $held->on_hand,
                    ])->values()->all(),
                ])->all(),
        ];
    }

    /**
     * Every stock item with this branch's on hand. Items never counted here show 0.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function stock(Branch $branch): Collection
    {
        $onHand = $branch->stock()->get()->keyBy('stock_item_id');

        return StockItem::orderBy('name')->get()->map(function (StockItem $item) use ($onHand) {
            /** @var BranchStock|null $count */
            $count = $onHand->get($item->id);
            $qty = (float) ($count->on_hand ?? 0);

            return [
                'id' => $item->id,
                'sku' => $item->sku,
                'name' => $item->name,
                'category' => $item->category,
                'unit' => $item->unit,
                'par' => (float) $item->par,
                'cost' => (float) $item->cost,
                'on_hand' => $qty,
                'counted_on' => $count?->counted_on?->toDateString(),
                'low' => $qty < (float) $item->par * 0.5,
            ];
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function menu(Branch $branch): array
    {
        $entries = $branch->menuEntries()->with(['menuItem.ingredients', 'menuItem.addons'])->orderBy('sort')->get();

        return [
            'categories' => $branch->categories()->orderBy('sort')->withCount('menuEntries')->get()
                ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'count' => $category->menu_entries_count])
                ->all(),
            'items' => $entries->map(fn (BranchMenuItem $entry) => [
                'entry_id' => $entry->id,
                'id' => $entry->menuItem->id,
                'name' => $entry->menuItem->name,
                'note' => $entry->menuItem->note,
                'price' => (float) $entry->menuItem->price,
                'category_id' => $entry->category_id,
                'available' => $entry->available,
                'has_modifiers' => $entry->menuItem->has_modifiers,
                'photo_url' => $entry->menuItem->photo_path ? Storage::disk('public')->url($entry->menuItem->photo_path) : null,
                'recipe' => $entry->menuItem->ingredients
                    ->map(fn (StockItem $stock) => ['stock_item_id' => $stock->id, 'qty' => (float) $stock->pivot->qty])
                    ->all(),
                'addon_ids' => $entry->menuItem->addons->pluck('id')->all(),
            ])->all(),
            'otherItems' => MenuItem::whereNotIn('id', $entries->pluck('menu_item_id'))->orderBy('name')->get(['id', 'name'])->toArray(),
            'stockItems' => $this->stockChoices(),
            'addons' => Addon::orderBy('id')->get()->map(fn (Addon $addon) => ['id' => $addon->id, 'name' => $addon->name, 'price' => (float) $addon->price])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function addons(Branch $branch): array
    {
        $offHere = $branch->disabledAddons()->pluck('addons.id');

        return [
            'addons' => Addon::with(['parts', 'menuItems'])->orderBy('id')->get()->map(fn (Addon $addon) => [
                'id' => $addon->id,
                'name' => $addon->name,
                'price' => (float) $addon->price,
                'on' => ! $offHere->contains($addon->id),
                'parts' => $addon->parts->map(fn (StockItem $stock) => ['stock_item_id' => $stock->id, 'qty' => (float) $stock->pivot->qty])->all(),
                'menu_item_ids' => $addon->menuItems->pluck('id')->all(),
            ])->all(),
            'stockItems' => $this->stockChoices(),
            'menuGroups' => $branch->categories()->orderBy('sort')->with(['menuEntries' => fn ($query) => $query->orderBy('sort')->with('menuItem')])->get()
                ->map(fn (Category $category) => [
                    'name' => $category->name,
                    'items' => $category->menuEntries->map(fn (BranchMenuItem $entry) => ['id' => $entry->menu_item_id, 'name' => $entry->menuItem->name])->all(),
                ])
                ->filter(fn (array $group) => $group['items'] !== [])
                ->values()->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function paymentMethods(Branch $branch): array
    {
        return [
            'methods' => $branch->paymentMethods()->orderBy('id')->get()->map(fn (PaymentMethod $method) => [
                'id' => $method->id,
                'name' => $method->name,
                'kind' => $method->kind,
                'split' => $method->split,
                'note' => $method->note,
                'terminal' => $method->terminal,
                'wallets' => $method->wallets,
                'tab_limit' => $method->tab_limit === null ? null : (float) $method->tab_limit,
                'lead_only' => $method->lead_only,
                'active' => $method->active,
            ])->all(),
            'log' => $branch->paymentMethodLogs()->with('user')->latest('id')->limit(40)->get()->map(fn (PaymentMethodLog $log) => [
                'id' => $log->id,
                'who' => $log->user ? explode(' ', $log->user->name)[0] : 'Staff',
                'text' => $log->description,
                'when' => $log->created_at->toIso8601String(),
            ])->all(),
        ];
    }

    /**
     * Receipts (sales and refunds) in the date range, the unpaid orders, and the refund choices.
     *
     * @param  array{from?: ?string, to?: ?string}  $filters
     * @return array<string, mixed>
     */
    private function sales(Branch $branch, array $filters): array
    {
        $query = $branch->orders()
            ->with(['lines.refundLines', 'lines.addons', 'payments', 'cashier', 'refundOf'])
            ->latest('id')
            ->limit(self::SALES_LIMIT);

        if ($filters['from'] ?? null) {
            $query->where('created_at', '>=', BusinessDay::bounds($filters['from'])[0]);
        }

        if ($filters['to'] ?? null) {
            $query->where('created_at', '<=', BusinessDay::bounds($filters['to'])[1]);
        }

        [$todayStart, $todayEnd] = BusinessDay::bounds(BusinessDay::today());

        return [
            'filters' => ['from' => $filters['from'] ?? null, 'to' => $filters['to'] ?? null],
            'today' => BusinessDay::today(),
            'limit' => self::SALES_LIMIT,
            'receipts' => $query->get()->map(fn (Order $order) => $this->receipt($order))->all(),
            'todayTotals' => [
                'total' => (float) $branch->orders()->where('unpaid', false)->whereBetween('created_at', [$todayStart, $todayEnd])->sum('total'),
                'count' => $branch->orders()->whereNull('refund_of')->where('unpaid', false)->whereBetween('created_at', [$todayStart, $todayEnd])->count(),
            ],
            'unpaid' => $this->unpaidOrders($branch),
            'refundReasons' => RefundService::REASONS,
            'refundMethods' => array_keys(RefundService::METHODS),
        ];
    }

    /**
     * A receipt row on the Sales tab.
     *
     * @return array<string, mixed>
     */
    private function receipt(Order $order): array
    {
        $payments = $order->payments->map(fn (OrderPayment $payment) => ['method' => $payment->method_name, 'amount' => (float) $payment->amount])->all();

        return [
            'id' => $order->id,
            'no' => $order->no,
            'created_at' => $order->created_at->toIso8601String(),
            'service' => $order->service->label(),
            'ticket' => $order->ticket,
            'method' => match (true) {
                $order->isRefund() => 'Refund',
                $order->unpaid => $order->tab_name ? 'Tab' : 'Unpaid',
                count($payments) > 1 => 'Split',
                default => $payments[0]['method'] ?? '—',
            },
            'payments' => $payments,
            'unpaid' => $order->unpaid,
            'tab_name' => $order->tab_name,
            'senior' => $order->senior,
            'gross' => (float) $order->gross,
            'discount' => (float) $order->discount,
            'vat_exempt' => (float) $order->vat_exempt,
            'vat' => (float) $order->vat,
            'total' => (float) $order->total,
            'cashier' => $order->cashier?->name,
            'refund_of_no' => $order->refundOf?->no,
            'refund_reason' => $order->refund_reason,
            'lines' => $order->lines->map(fn (OrderLine $line) => [
                'id' => $line->id,
                'qty' => $line->qty,
                'name' => $line->name,
                'mods' => $line->modsLabel(),
                'line_total' => (float) $line->line_total,
                'refunded' => (int) $line->refundLines->sum('qty'),
            ])->all(),
        ];
    }

    /**
     * Orders still waiting for payment: tabs and Branch Menu orders.
     *
     * @return list<array<string, mixed>>
     */
    private function unpaidOrders(Branch $branch): array
    {
        return $branch->orders()->where('unpaid', true)->with('marketingOrder')->latest('id')->get()->map(fn (Order $order) => [
            'id' => $order->id,
            'no' => $order->no,
            'ticket' => $order->ticket,
            'tab_name' => $order->tab_name,
            'label' => match (true) {
                $order->tab_name !== null => "Tab for {$order->tab_name}",
                $order->marketingOrder !== null => "Marketing {$order->marketingOrder->number()} · {$order->marketingOrder->customer}",
                default => 'Sent from the Branch Menu',
            },
            'total' => (float) $order->total,
            'created_at' => $order->created_at->toIso8601String(),
        ])->all();
    }

    /**
     * Stock items for the recipe and add-on ingredient pickers.
     *
     * @return list<array{id: int, name: string, unit: string, cost: float}>
     */
    private function stockChoices(): array
    {
        return StockItem::orderBy('name')->get()
            ->map(fn (StockItem $item) => ['id' => $item->id, 'name' => $item->name, 'unit' => $item->unit, 'cost' => (float) $item->cost])
            ->all();
    }
}
