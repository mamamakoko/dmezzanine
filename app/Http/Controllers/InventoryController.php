<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\BranchKind;
use App\Http\Resources\TransferResource;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\ShoppingListLine;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\WarehouseStock;
use App\Services\BackOffice;
use App\Services\BusinessDay;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Inventory: the warehouse's stock and shopping list, the commissary's production, transfers between
 * locations (branch requisitions included), suppliers and the transfer history. Only the open screen's
 * data is built.
 */
class InventoryController extends Controller
{
    public const SCREENS = ['dash', 'wh', 'cm', 'shop', 'sup', 'hist'];

    /**
     * Each location's transfers list, and the history, show at most this many, newest first.
     */
    public const TRANSFERS_LIMIT = 300;

    public function show(Request $request): Response
    {
        $screen = in_array($request->query('screen'), self::SCREENS, true) ? $request->query('screen') : 'dash';
        $warehouse = Branch::where('kind', BranchKind::Warehouse)->orderBy('id')->first();
        $commissary = Branch::where('kind', BranchKind::Commissary)->orderBy('id')->first();
        $user = $request->user();

        return Inertia::render('inventory/index', [
            'screen' => $screen,
            'today' => BusinessDay::today(),
            'locations' => [
                'wh' => $warehouse ? ['id' => $warehouse->id, 'name' => $warehouse->name, 'can' => Gate::allows('manageStock', $warehouse)] : null,
                'cm' => $commissary ? ['id' => $commissary->id, 'name' => $commissary->name, 'can' => Gate::allows('manageStock', $commissary)] : null,
            ],
            'lowCount' => $warehouse ? $this->stockRows($warehouse)->filter(fn (array $row) => $row['on_hand'] < $row['par'])->count() : 0,
            'openBatches' => $commissary ? ProductionBatch::where('branch_id', $commissary->id)->where('status', '!=', BatchStatus::Delivered)->count() : 0,
            ...match ($screen) {
                'dash' => $this->dashboard($request, array_filter([$warehouse, $commissary])),
                'wh' => $warehouse ? $this->location($warehouse) : [],
                'cm' => $commissary ? [...$this->location($commissary), ...$this->production($commissary, $warehouse)] : [],
                'shop' => $this->shoppingList(),
                'sup' => ['suppliers' => $this->suppliers()],
                'hist' => ['transfers' => $this->transfers(Transfer::query())],
            },
            'isOwner' => $user->isOwner(),
        ]);
    }

    /**
     * Needs attention (below par at the warehouse and the commissary), stock value, and what each location
     * delivered out in the month.
     *
     * @param  array<int, Branch>  $locations
     * @return array<string, mixed>
     */
    private function dashboard(Request $request, array $locations): array
    {
        $month = preg_match('/^\d{4}-\d{2}$/', (string) $request->query('month')) ? $request->query('month') : substr(BusinessDay::today(), 0, 7);
        [$start, $end] = BusinessDay::monthBounds($month);
        $listed = ShoppingListLine::whereNotNull('stock_item_id')->pluck('stock_item_id');
        $byLocation = collect($locations)->mapWithKeys(fn (Branch $location) => [$location->id => $this->stockRows($location)]);

        return [
            'month' => $month,
            'low' => collect($locations)->flatMap(fn (Branch $location) => $byLocation[$location->id]
                ->filter(fn (array $row) => $row['on_hand'] < $row['par'])
                ->map(fn (array $row) => [...$row, 'location' => $location->name, 'in_list' => $listed->contains($row['stock_item_id'])]))
                ->values()->all(),
            'onHand' => collect($locations)->map(fn (Branch $location) => [
                'name' => $location->name,
                'items' => $byLocation[$location->id]->count(),
                'value' => round($byLocation[$location->id]->sum(fn (array $row) => $row['on_hand'] * $row['cost']), 2),
            ])->values()->all(),
            'delivered' => TransferLine::whereNotNull('received_at')
                ->whereHas('transfer', fn ($query) => $query
                    ->whereIn('from_branch_id', collect($locations)->pluck('id'))
                    ->whereBetween('created_at', [$start, $end]))
                ->with(['transfer', 'stockItem'])
                ->get()
                ->map(fn (TransferLine $line) => [
                    'transfer_id' => $line->transfer_id,
                    'from_id' => $line->transfer->from_branch_id,
                    'name' => $line->stockItem->name,
                    'unit' => $line->stockItem->unit,
                    'qty' => (float) $line->qty,
                ])->all(),
        ];
    }

    /**
     * A warehouse or commissary's stock and its transfers, with the items it can ask another location for.
     *
     * @return array<string, mixed>
     */
    private function location(Branch $location): array
    {
        return [
            'items' => $this->stockRows($location)->values()->all(),
            'suppliers' => Supplier::orderBy('name')->get(['id', 'name'])->toArray(),
            'units' => BackOffice::UNITS,
            'transfers' => $this->transfers(Transfer::where(fn ($query) => $query->where('from_branch_id', $location->id)->orWhere('to_branch_id', $location->id))),
            'sources' => Branch::where('kind', '!=', BranchKind::Branch)->whereKeyNot($location->id)->orderBy('id')->get()
                ->map(fn (Branch $source) => [
                    'id' => $source->id,
                    'name' => $source->name,
                    'items' => $this->stockRows($source)->map(fn (array $row) => [
                        'id' => $row['stock_item_id'],
                        'sku' => $row['sku'],
                        'name' => $row['name'],
                        'category' => $row['category'],
                        'unit' => $row['unit'],
                        'on_hand' => $row['on_hand'],
                    ])->values()->all(),
                ])->all(),
        ];
    }

    /**
     * The commissary's products with their recipes, its batches, and the warehouse stock the recipes
     * draw on.
     *
     * @return array<string, mixed>
     */
    private function production(Branch $commissary, ?Branch $warehouse): array
    {
        $atWarehouse = $warehouse ? $warehouse->warehouseStock()->pluck('on_hand', 'stock_item_id') : collect();

        return [
            'products' => Product::with(['stockItem', 'ingredients'])->get()->sortBy('stockItem.name')->map(fn (Product $product) => [
                'id' => $product->id,
                'stock_item_id' => $product->stock_item_id,
                'name' => $product->stockItem->name,
                'sku' => $product->stockItem->sku,
                'category' => $product->stockItem->category,
                'unit' => $product->stockItem->unit,
                'servings_per_batch' => $product->servings_per_batch === null ? null : (float) $product->servings_per_batch,
                'serving_size' => $product->serving_size,
                'serving_unit' => $product->serving_unit,
                'stock_per_batch' => $product->stock_per_batch === null ? null : (float) $product->stock_per_batch,
                'ingredients' => $product->ingredients->map(fn (StockItem $item) => ['stock_item_id' => $item->id, 'qty' => (float) $item->pivot->qty])->values()->all(),
            ])->values()->all(),
            'batches' => ProductionBatch::where('branch_id', $commissary->id)->with(['product.stockItem', 'transfer'])->latest('id')->limit(200)->get()
                ->map(fn (ProductionBatch $batch) => [
                    'id' => $batch->id,
                    'product_id' => $batch->product_id,
                    'name' => $batch->product->stockItem->name,
                    'batches' => (float) $batch->batches,
                    'status' => $batch->status,
                    'status_label' => $batch->status->label(),
                    'logged_at' => $batch->created_at->toIso8601String(),
                    'transfer_no' => $batch->transfer?->number(),
                ])->all(),
            'ingredientChoices' => StockItem::whereDoesntHave('product')->orderBy('name')->get()->map(fn (StockItem $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'sku' => $item->sku,
                'category' => $item->category,
                'unit' => $item->unit,
                'at_warehouse' => $atWarehouse->has($item->id) ? (float) $atWarehouse[$item->id] : null,
            ])->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function shoppingList(): array
    {
        return [
            'lines' => ShoppingListLine::with('branch')->orderBy('id')->get()->map(fn (ShoppingListLine $line) => [
                'id' => $line->id,
                'location' => $line->branch?->kind->value,
                'name' => $line->name,
                'unit' => $line->unit,
                'cost' => (float) $line->cost,
                'qty' => (float) $line->qty,
                'ticked' => $line->ticked,
                'reason' => $line->reason,
            ])->all(),
            'deliverTo' => Branch::orderBy('id')->pluck('name')->all(),
            'suppliers' => Supplier::orderBy('name')->pluck('name')->all(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function suppliers(): array
    {
        return Supplier::orderBy('name')->get(['id', 'name', 'contact', 'phone', 'supplies'])->toArray();
    }

    /**
     * What a warehouse or commissary holds, by item.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function stockRows(Branch $location): Collection
    {
        return $location->warehouseStock()->with('stockItem.supplier')->get()
            ->sortBy('stockItem.name')
            ->map(fn (WarehouseStock $held) => [
                'id' => $held->id,
                'stock_item_id' => $held->stock_item_id,
                'name' => $held->stockItem->name,
                'sku' => $held->stockItem->sku,
                'category' => $held->stockItem->category,
                'unit' => $held->stockItem->unit,
                'cost' => (float) $held->stockItem->cost,
                'on_hand' => (float) $held->on_hand,
                'par' => (float) $held->par,
                'critical' => $held->critical === null ? null : (float) $held->critical,
                'critical_level' => $held->criticalLevel(),
                'supplier_id' => $held->stockItem->supplier_id,
                'supplier' => $held->stockItem->supplier?->name,
                'pack_name' => $held->stockItem->pack_name,
                'pack_size' => $held->stockItem->pack_size === null ? null : (float) $held->stockItem->pack_size,
            ]);
    }

    /**
     * @param  Builder<Transfer>  $query
     * @return list<array<string, mixed>>
     */
    private function transfers(Builder $query): array
    {
        return TransferResource::collection(
            $query->with(BackOffice::TRANSFER_RELATIONS)->latest('id')->limit(self::TRANSFERS_LIMIT)->get(),
        )->resolve();
    }
}
