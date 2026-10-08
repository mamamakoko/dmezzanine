<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\StockItem;
use App\Models\WarehouseStock;
use App\Services\BackOffice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The warehouse's (or commissary's) stock list. One item has one SKU everywhere: adding an item by the name
 * or SKU of an existing item links to that item (its details stay as they are), and editing an item's name, SKU, category, unit, cost,
 * supplier or packaging changes it everywhere. On hand and the low and critical levels belong to the
 * location.
 */
class WarehouseItemController extends Controller
{
    public function store(Request $request, Branch $branch): RedirectResponse
    {
        Gate::authorize('manageStock', $branch);

        $data = $this->validated($request, linking: true);
        $matches = StockItem::where('sku', strtoupper($data['sku']))->orWhere('name', $data['name'])->get();

        if ($matches->count() > 1) {
            throw ValidationException::withMessages(['sku' => "That SKU belongs to {$matches->firstWhere('name', '!=', $data['name'])?->name}. Use its name, or a new SKU."]);
        }

        $existing = $matches->first();

        if ($existing && $branch->warehouseStock()->where('stock_item_id', $existing->id)->exists()) {
            throw ValidationException::withMessages(['name' => "{$existing->name} is already on {$branch->name}'s list."]);
        }

        DB::transaction(function () use ($branch, $data, $existing) {
            $item = $existing ?? StockItem::create([...$this->itemFields($data), 'par' => $data['par']]);
            $branch->warehouseStock()->create(['stock_item_id' => $item->id, ...$this->levels($data)]);
        });

        return back();
    }

    public function update(Request $request, WarehouseStock $warehouseStock): RedirectResponse
    {
        Gate::authorize('manageStock', $warehouseStock->branch);

        $data = $this->validated($request, $warehouseStock->stockItem);

        DB::transaction(function () use ($warehouseStock, $data) {
            $warehouseStock->stockItem->update($this->itemFields($data));
            $warehouseStock->update($this->levels($data));
        });

        return back();
    }

    /**
     * Correct the on-hand figure (the − and + steppers, or a typed count).
     */
    public function adjust(Request $request, WarehouseStock $warehouseStock): RedirectResponse
    {
        Gate::authorize('manageStock', $warehouseStock->branch);

        $warehouseStock->update($request->validate(['on_hand' => ['required', 'numeric', 'min:0', 'max:1000000']]));

        return back();
    }

    /**
     * Take the item off this location's list. The item itself stays for the other locations.
     */
    public function destroy(WarehouseStock $warehouseStock): RedirectResponse
    {
        Gate::authorize('manageStock', $warehouseStock->branch);

        $warehouseStock->delete();

        return back();
    }

    /**
     * Rename a category on every item this location stocks in it.
     */
    public function renameCategory(Request $request, Branch $branch): RedirectResponse
    {
        Gate::authorize('manageStock', $branch);

        $data = $request->validate([
            'from' => ['required', 'string', 'max:60'],
            'to' => ['required', 'string', 'max:60'],
        ]);

        StockItem::whereIn('id', $branch->warehouseStock()->select('stock_item_id'))
            ->where('category', $data['from'])
            ->update(['category' => $data['to']]);

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?StockItem $item = null, bool $linking = false): array
    {
        $unique = fn (string $column) => $linking ? [] : [Rule::unique('stock_items', $column)->ignore($item)];

        return $request->validate([
            'name' => ['required', 'string', 'max:120', ...$unique('name')],
            'sku' => ['required', 'string', 'max:30', ...$unique('sku')],
            'category' => ['required', 'string', 'max:60'],
            'unit' => ['required', Rule::in(BackOffice::UNITS)],
            'on_hand' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'par' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'critical' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'cost' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'pack_name' => ['nullable', 'string', 'max:30'],
            'pack_size' => ['nullable', 'numeric', 'gt:0', 'max:100000'],
        ], [
            'name.unique' => 'Another item already has that name.',
            'sku.unique' => 'Another item already has that SKU.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function itemFields(array $data): array
    {
        return [
            'name' => $data['name'],
            'sku' => strtoupper($data['sku']),
            'category' => $data['category'],
            'unit' => $data['unit'],
            'cost' => $data['cost'],
            'supplier_id' => $data['supplier_id'] ?? null,
            'pack_name' => $data['pack_name'] ?? null,
            'pack_size' => $data['pack_size'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{on_hand: mixed, par: mixed, critical: mixed}
     */
    private function levels(array $data): array
    {
        return ['on_hand' => $data['on_hand'], 'par' => $data['par'], 'critical' => $data['critical'] ?? null];
    }
}
