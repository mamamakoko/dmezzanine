<?php

namespace App\Http\Controllers\Inventory;

use App\Enums\BranchKind;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\StockItem;
use App\Services\BackOffice;
use App\Services\Production;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * The commissary's semi-finished products, their recipes, and the batches it makes of them. The commissary's
 * staff or the Owner change them.
 */
class ProductController extends Controller
{
    public function __construct(private Production $production) {}

    /**
     * A new product, with its own stock item (WH-SEM-…) for the warehouse to store.
     */
    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('manageStock', $this->commissary());

        $data = $this->validated($request);

        DB::transaction(function () use ($data) {
            $item = StockItem::create([
                'name' => $data['name'],
                'sku' => $this->production->nextSku(),
                'category' => 'Semi-finished',
                'unit' => $data['unit'],
                'cost' => 0,
                'par' => 0,
            ]);
            $item->product()->create($this->productFields($data));
        });

        return back();
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        Gate::authorize('manageStock', $this->commissary());

        $data = $this->validated($request, $product);

        DB::transaction(function () use ($product, $data) {
            $product->stockItem->update(['name' => $data['name'], 'unit' => $data['unit']]);
            $product->update($this->productFields($data));
            $this->production->updateCost($product);
        });

        return back();
    }

    /**
     * Remove the product and its recipe. Its stock item stays, with any stock the warehouse holds of it.
     */
    public function destroy(Product $product): RedirectResponse
    {
        Gate::authorize('manageStock', $this->commissary());

        $product->delete();

        return back();
    }

    /**
     * Replace the recipe: the ingredients one batch uses.
     */
    public function recipe(Request $request, Product $product): RedirectResponse
    {
        Gate::authorize('manageStock', $this->commissary());

        $data = $request->validate([
            'ingredients' => ['present', 'array', 'max:40'],
            'ingredients.*.stock_item_id' => ['required', 'integer', 'distinct', Rule::exists('stock_items', 'id'), Rule::notIn([$product->stock_item_id])],
            'ingredients.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
        ]);

        $this->production->saveRecipe($product, collect($data['ingredients'])->mapWithKeys(
            fn (array $line) => [(int) $line['stock_item_id'] => (float) $line['qty']],
        )->all());

        return back();
    }

    /**
     * Log batches of the product to make.
     */
    public function logBatch(Request $request, Product $product): RedirectResponse
    {
        $commissary = $this->commissary();
        Gate::authorize('manageStock', $commissary);

        $batches = $request->validate(['batches' => ['required', 'numeric', 'gt:0', 'max:1000']])['batches'];
        $this->production->log($commissary, $product, (float) $batches, $request->user());

        return back();
    }

    /**
     * Move a batch along: start it, mark it ready, or deliver it to the warehouse.
     */
    public function advanceBatch(Request $request, ProductionBatch $productionBatch): RedirectResponse
    {
        Gate::authorize('manageStock', $productionBatch->branch);

        match ($request->validate(['step' => ['required', Rule::in(['start', 'ready', 'deliver'])]])['step']) {
            'start' => $this->production->start($productionBatch),
            'ready' => $this->production->ready($productionBatch),
            'deliver' => $this->production->deliver($productionBatch, $request->user()),
        };

        return back();
    }

    private function commissary(): Branch
    {
        return Branch::where('kind', BranchKind::Commissary)->orderBy('id')->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Product $product = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('stock_items', 'name')->ignore($product?->stock_item_id)],
            'servings_per_batch' => ['nullable', 'numeric', 'gt:0', 'max:100000'],
            'serving_size' => ['nullable', 'string', 'max:20'],
            'serving_unit' => ['nullable', 'string', 'max:20'],
            'stock_per_batch' => ['nullable', 'numeric', 'gt:0', 'max:100000'],
            'unit' => ['required', Rule::in(BackOffice::UNITS)],
        ], [
            'name.unique' => 'An item with that name already exists.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function productFields(array $data): array
    {
        return [
            'servings_per_batch' => $data['servings_per_batch'] ?? null,
            'serving_size' => $data['serving_size'] ?? null,
            'serving_unit' => $data['serving_unit'] ?? null,
            'stock_per_batch' => $data['stock_per_batch'] ?? null,
        ];
    }
}
