<?php

use App\Enums\BatchStatus;
use App\Enums\TransferKind;
use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\User;
use App\Models\WarehouseStock;
use App\Services\Production;
use Illuminate\Validation\ValidationException;

test('starting a batch takes its ingredients off the commissary\'s stock, down to zero at most', function () {
    $commissary = Branch::factory()->commissary()->create();
    $product = Product::factory()->create();
    $robusta = WarehouseStock::factory()->for($commissary)->create(['on_hand' => 2]);
    $arabica = WarehouseStock::factory()->for($commissary)->create(['on_hand' => 0.1]);
    $product->ingredients()->attach([$robusta->stock_item_id => ['qty' => 0.25], $arabica->stock_item_id => ['qty' => 0.1]]);
    $batch = ProductionBatch::factory()->for($commissary)->for($product)->create(['batches' => 3]);

    app(Production::class)->start($batch);

    expect($batch->fresh()->status)->toBe(BatchStatus::InProduction)
        ->and($robusta->fresh()->on_hand)->toBe('1.250')
        ->and($arabica->fresh()->on_hand)->toBe('0.000');
});

test('delivering a ready batch sends its stock to the warehouse', function () {
    $warehouse = Branch::factory()->warehouse()->create();
    $product = Product::factory()->create(['stock_per_batch' => 10]);
    $batch = ProductionBatch::factory()->ready()->for($product)->create(['batches' => 2]);

    app(Production::class)->deliver($batch, User::factory()->create());

    $transfer = Transfer::with('lines')->sole();
    expect($transfer)
        ->kind->toBe(TransferKind::CommissaryOutput)
        ->status->toBe(TransferStatus::InTransit)
        ->to_branch_id->toBe($warehouse->id)
        ->and($transfer->lines->sole()->only(['stock_item_id', 'qty']))->toBe(['stock_item_id' => $product->stock_item_id, 'qty' => '20.000'])
        ->and($batch->fresh())->status->toBe(BatchStatus::Delivered)->transfer_id->toBe($transfer->id);
});

test('a batch can\'t be delivered before it is ready', function () {
    Branch::factory()->warehouse()->create();
    $batch = ProductionBatch::factory()->create();

    expect(fn () => app(Production::class)->deliver($batch, User::factory()->create()))->toThrow(ValidationException::class, 'Mark the batch ready first.');
    $this->assertDatabaseEmpty('transfers');
});

test('saving a recipe prices the product per unit of the stock a batch makes', function () {
    $product = Product::factory()->create(['stock_per_batch' => 10]);
    $robusta = StockItem::factory()->create(['cost' => 480]);
    $arabica = StockItem::factory()->create(['cost' => 620]);

    app(Production::class)->saveRecipe($product, [$robusta->id => 0.25, $arabica->id => 0.1]);

    expect($product->stockItem->fresh()->cost)->toBe('18.20');
});
