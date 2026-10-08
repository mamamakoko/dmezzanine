<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\StockItem;
use App\Models\User;
use App\Models\WarehouseStock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The commissary's batches: logged to produce, started (the recipe's ingredients come off the commissary's
 * stock), ready, then delivered to the warehouse, which receives the batch's stock on a transfer.
 */
class Production
{
    public function __construct(private Transfers $transfers) {}

    public function log(Branch $commissary, Product $product, float $batches, User $by): ProductionBatch
    {
        return $product->batches()->create([
            'branch_id' => $commissary->id,
            'batches' => $batches,
            'status' => BatchStatus::ToProduce,
            'logged_by_id' => $by->id,
        ]);
    }

    /**
     * Start making the batch: each ingredient comes off the commissary's stock, down to zero at most, since
     * the commissary's counts aren't kept day to day.
     */
    public function start(ProductionBatch $batch): void
    {
        DB::transaction(function () use ($batch) {
            $batch = ProductionBatch::with('product.ingredients')->lockForUpdate()->findOrFail($batch->id);
            $this->ensureStatus($batch, BatchStatus::ToProduce, 'This batch is already started.');

            foreach ($batch->product->ingredients as $ingredient) {
                $held = WarehouseStock::where('branch_id', $batch->branch_id)->where('stock_item_id', $ingredient->id)->lockForUpdate()->first();
                $held?->update(['on_hand' => max(0, (float) $held->on_hand - (float) $ingredient->pivot->qty * (float) $batch->batches)]);
            }

            $batch->update(['status' => BatchStatus::InProduction]);
        });
    }

    public function ready(ProductionBatch $batch): void
    {
        $this->ensureStatus($batch, BatchStatus::InProduction, 'Start the batch first.');

        $batch->update(['status' => BatchStatus::Ready]);
    }

    /**
     * Send the batch's stock to the warehouse: batches × stock per batch of the product's item.
     */
    public function deliver(ProductionBatch $batch, User $by): void
    {
        DB::transaction(function () use ($batch, $by) {
            $batch = ProductionBatch::with(['product.stockItem', 'branch'])->lockForUpdate()->findOrFail($batch->id);
            $this->ensureStatus($batch, BatchStatus::Ready, 'Mark the batch ready first.');

            $warehouse = Branch::where('kind', BranchKind::Warehouse)->orderBy('id')->firstOrFail();
            $perBatch = (float) $batch->product->stock_per_batch;
            $qty = (float) $batch->batches * ($perBatch > 0 ? $perBatch : 1);

            $transfer = $this->transfers->commissaryOutput($batch->branch, $warehouse, $batch->product->stockItem, $qty, $by);
            $batch->update(['status' => BatchStatus::Delivered, 'transfer_id' => $transfer->id]);
        });
    }

    /**
     * Store a product's recipe and set its stock item's cost from it.
     *
     * @param  array<int, float>  $ingredients  quantity per batch by stock item id
     */
    public function saveRecipe(Product $product, array $ingredients): void
    {
        DB::transaction(function () use ($product, $ingredients) {
            $product->ingredients()->sync(collect($ingredients)->map(fn (float $qty) => ['qty' => $qty])->all());
            $this->updateCost($product);
        });
    }

    /**
     * The product's stock item costs what one unit of its batch's ingredients cost.
     */
    public function updateCost(Product $product): void
    {
        $product->load('ingredients', 'stockItem');
        $product->stockItem->update(['cost' => $product->unitCost()]);
    }

    /**
     * The next free semi-finished SKU: WH-SEM-001, WH-SEM-002 …
     */
    public function nextSku(): string
    {
        $used = StockItem::where('sku', 'like', 'WH-SEM-%')->pluck('sku');
        $n = 1;

        while ($used->contains(sprintf('WH-SEM-%03d', $n))) {
            $n++;
        }

        return sprintf('WH-SEM-%03d', $n);
    }

    private function ensureStatus(ProductionBatch $batch, BatchStatus $status, string $message): void
    {
        if ($batch->status !== $status) {
            throw ValidationException::withMessages(['batch' => $message]);
        }
    }
}
