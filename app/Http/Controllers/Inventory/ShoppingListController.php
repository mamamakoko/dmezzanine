<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\ShoppingListLine;
use App\Models\WarehouseStock;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The warehouse's shopping list. A line added from a below-par item copies it, topped up to par; a
 * manual line starts blank. Anyone in Inventory keeps the list.
 */
class ShoppingListController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['warehouse_stock_id' => ['nullable', 'integer', 'exists:warehouse_stock,id']]);

        if (! isset($data['warehouse_stock_id'])) {
            ShoppingListLine::create(['name' => 'New item', 'unit' => 'pc', 'cost' => 0, 'qty' => 1, 'reason' => 'Added manually']);

            return back();
        }

        $held = WarehouseStock::with(['stockItem', 'branch'])->findOrFail($data['warehouse_stock_id']);

        if (ShoppingListLine::where('stock_item_id', $held->stock_item_id)->exists()) {
            throw ValidationException::withMessages(['warehouse_stock_id' => "{$held->stockItem->name} is already on the list."]);
        }

        $onHand = (float) $held->on_hand;
        $par = (float) $held->par;

        ShoppingListLine::create([
            'branch_id' => $held->branch_id,
            'stock_item_id' => $held->stock_item_id,
            'name' => $held->stockItem->name,
            'unit' => $held->stockItem->unit,
            'cost' => $held->stockItem->cost,
            'qty' => max(1, ceil($par - $onHand)),
            'reason' => "{$held->branch->name} · {$this->trim($onHand)} of {$this->trim($par)} par",
        ]);

        return back();
    }

    public function update(Request $request, ShoppingListLine $shoppingListLine): RedirectResponse
    {
        $shoppingListLine->update($request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:500'],
            'cost' => ['sometimes', 'required', 'numeric', 'min:0', 'max:1000000'],
            'qty' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100000'],
            'ticked' => ['sometimes', 'boolean'],
        ]));

        return back();
    }

    /**
     * Remove one line or the ticked ones.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ])['ids'];

        ShoppingListLine::whereKey($ids)->delete();

        return back();
    }

    private function trim(float $qty): string
    {
        return rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
    }
}
