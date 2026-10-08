<?php

use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\WarehouseStock;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('the branch lead requests stock from the warehouse', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $held = WarehouseStock::factory()->create(['on_hand' => 26]);

    $response = unlockedTill($branch)->post('/pos/requisitions', [
        'from_branch_id' => $held->branch_id,
        'lines' => [['stock_item_id' => $held->stock_item_id, 'qty' => 12]],
    ]);

    $response->assertSessionHasNoErrors();
    $transfer = Transfer::with('lines')->sole();
    expect($transfer)
        ->from_branch_id->toBe($held->branch_id)
        ->to_branch_id->toBe($branch->id)
        ->status->toBe(TransferStatus::Requested)
        ->and($transfer->lines->sole()->qty)->toBe('12.000');
});

test('a request needs at least one line', function () {
    $this->seed(RoleSeeder::class);

    $response = unlockedTill(Branch::factory()->create())->post('/pos/requisitions', [
        'from_branch_id' => Branch::factory()->warehouse()->create()->id,
        'lines' => [],
    ]);

    $response->assertSessionHasErrors(['lines' => 'Add at least one item to request.']);
});

test('a cashier can\'t request stock', function () {
    $this->seed(RoleSeeder::class);
    $held = WarehouseStock::factory()->create();

    $response = unlockedTill(Branch::factory()->create(), 'Cashier')->post('/pos/requisitions', [
        'from_branch_id' => $held->branch_id,
        'lines' => [['stock_item_id' => $held->stock_item_id, 'qty' => 1]],
    ]);

    $response->assertForbidden();
    $this->assertDatabaseEmpty('transfers');
});

test('receives a line on its way to the branch into its stock', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $transfer = Transfer::factory()->inTransit()->for($branch, 'to')->create();
    $line = TransferLine::factory()->for($transfer)->create(['qty' => 6]);

    $response = unlockedTill($branch)->post("/pos/transfers/{$transfer->id}/lines/{$line->id}/receive");

    $response->assertSessionHasNoErrors();
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $line->stock_item_id, 'on_hand' => 6]);
});

test('another branch\'s transfer answers 404', function () {
    $this->seed(RoleSeeder::class);
    $transfer = Transfer::factory()->inTransit()->create();
    TransferLine::factory()->for($transfer)->create();

    $response = unlockedTill(Branch::factory()->create())->post("/pos/transfers/{$transfer->id}/receive");

    $response->assertNotFound();
    expect($transfer->fresh()->status)->toBe(TransferStatus::InTransit);
});

test('a line must belong to the transfer it is received on', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $transfer = Transfer::factory()->inTransit()->for($branch, 'to')->create();
    $otherLine = TransferLine::factory()->for(Transfer::factory()->inTransit()->for($branch, 'to'))->create();

    $response = unlockedTill($branch)->post("/pos/transfers/{$transfer->id}/lines/{$otherLine->id}/receive");

    $response->assertNotFound();
});

test('flags an issue on a line that came in', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $transfer = Transfer::factory()->inTransit()->for($branch, 'to')->create();
    $line = TransferLine::factory()->for($transfer)->create();

    unlockedTill($branch)->put("/pos/transfers/{$transfer->id}/lines/{$line->id}/issue", ['reason' => 'short_delivery', 'note' => 'Counted 10 of 12']);

    $this->assertDatabaseHas('delivery_issues', ['transfer_line_id' => $line->id, 'reason' => 'short_delivery', 'note' => 'Counted 10 of 12']);
});

test('posts a supplier delivery of an item the café hasn\'t stocked, creating the item', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();

    $response = unlockedTill($branch)->post('/pos/deliveries', [
        'supplier' => 'Mezza Dairy',
        'name' => 'Almond milk',
        'sku' => 'wh-dry-030',
        'category' => 'Dairy',
        'unit' => 'L',
        'qty' => 6,
        'unit_cost' => 180,
    ]);

    $response->assertSessionHasNoErrors();
    $item = StockItem::sole();
    expect($item->only(['name', 'sku', 'category', 'unit', 'cost']))
        ->toBe(['name' => 'Almond milk', 'sku' => 'WH-DRY-030', 'category' => 'Dairy', 'unit' => 'L', 'cost' => '180.00']);
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $item->id, 'on_hand' => 6]);
});

test('a new item on a delivery needs its own SKU', function () {
    $this->seed(RoleSeeder::class);
    StockItem::factory()->create(['sku' => 'WH-DRY-030']);

    $response = unlockedTill(Branch::factory()->create())->post('/pos/deliveries', [
        'supplier' => 'Mezza Dairy',
        'name' => 'Almond milk',
        'sku' => 'WH-DRY-030',
        'category' => 'Dairy',
        'unit' => 'L',
        'qty' => 6,
        'unit_cost' => 180,
    ]);

    $response->assertSessionHasErrors(['sku' => 'Another item already has that SKU.']);
    $this->assertDatabaseEmpty('deliveries');
});

test('the Stock-in tab lists the branch\'s transfers and what the warehouse holds', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $held = WarehouseStock::factory()->create(['on_hand' => 26]);
    Transfer::factory()->inTransit()->for($branch, 'to')->create();
    Transfer::factory()->inTransit()->create();

    $response = unlockedTill($branch)->get('/pos?inv=stockin');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('backOffice.tab', 'stockin')
        ->where('backOffice.incomingCount', 1)
        ->has('backOffice.transfers', 1)
        ->where('backOffice.sources.0.items.0.id', $held->stock_item_id)
        ->where('backOffice.sources.0.items.0.on_hand', 26));
});
