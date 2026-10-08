<?php

namespace App\Http\Controllers\BackOffice;

use App\Http\Controllers\Concerns\HandlesTransfers;
use App\Models\Branch;
use App\Models\StockItem;
use App\Models\User;
use App\Services\BackOffice;
use App\Services\Transfers;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Stock-in on the till: receiving a supplier's delivery, requesting stock from the warehouse or the
 * commissary, and receiving or cancelling the branch's transfers.
 */
class StockInController extends BackOfficeController
{
    use HandlesTransfers;

    /**
     * Post a supplier's delivery to the branch's stock. A name no item has yet makes a new stock item,
     * which needs its own SKU and category.
     */
    public function receiveDelivery(Request $request, Transfers $transfers): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manageStock', $branch);

        $data = $request->validate([
            'supplier' => ['required', 'string', 'max:120'],
            'stock_item_id' => ['nullable', 'integer', 'exists:stock_items,id'],
            'name' => ['required_without:stock_item_id', 'nullable', 'string', 'max:120', 'unique:stock_items,name'],
            'sku' => ['required_without:stock_item_id', 'nullable', 'string', 'max:30', 'unique:stock_items,sku'],
            'category' => ['required_without:stock_item_id', 'nullable', 'string', 'max:60'],
            'unit' => ['required_without:stock_item_id', 'nullable', Rule::in(BackOffice::UNITS)],
            'qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'unit_cost' => ['required', 'numeric', 'min:0', 'max:1000000'],
        ], [
            'name.required_without' => 'Name the item you are receiving.',
            'name.unique' => 'An item with that name already exists. Pick it from the list.',
            'sku.required_without' => 'Give the new item a SKU.',
            'sku.unique' => 'Another item already has that SKU.',
            'category.required_without' => 'Give the new item a category.',
        ]);

        DB::transaction(function () use ($data, $branch, $transfers) {
            $item = isset($data['stock_item_id'])
                ? StockItem::findOrFail($data['stock_item_id'])
                : StockItem::create([
                    'name' => $data['name'],
                    'sku' => strtoupper($data['sku']),
                    'category' => $data['category'],
                    'unit' => $data['unit'],
                    'cost' => $data['unit_cost'],
                    'par' => $data['qty'],
                ]);

            $transfers->receiveFromSupplier($branch, $data['supplier'], $item, (float) $data['qty'], (float) $data['unit_cost'], $this->staff());
        });

        return back();
    }

    /**
     * Ask the warehouse or the commissary for stock.
     */
    public function requisition(Request $request, Transfers $transfers): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manageStock', $branch);

        $data = $this->validatedRequisition($request);
        $transfers->requisition(Branch::findOrFail($data['from_branch_id']), $branch, $this->requestedLines($data), $this->staff());

        return back();
    }

    protected function actor(): User
    {
        return $this->staff();
    }

    protected function authorizeActor(string $ability, mixed $arguments): void
    {
        $this->authorizeStaff($ability, $arguments);
    }
}
