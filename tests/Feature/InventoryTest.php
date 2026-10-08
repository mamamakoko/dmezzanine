<?php

use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use App\Models\ShoppingListLine;
use App\Models\StockItem;
use App\Models\Supplier;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\User;
use App\Models\WarehouseStock;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Warehouse staff at the warehouse.
 */
function warehouseStaff(?Branch $warehouse = null): User
{
    return User::factory()->withRole('Warehouse')->for($warehouse ?? Branch::factory()->warehouse()->create())->create();
}

test('opens each screen for warehouse staff', function (string $screen, string $prop) {
    $this->seed(RoleSeeder::class);
    $warehouse = Branch::factory()->warehouse()->create();
    Branch::factory()->commissary()->create();

    $response = $this->actingAs(warehouseStaff($warehouse))->get("/inventory?screen={$screen}");

    $response->assertInertia(fn (Assert $page) => $page->component('inventory/index')->where('screen', $screen)->has($prop));
})->with([
    'dashboard' => ['dash', 'low'],
    'warehouse stock' => ['wh', 'items'],
    'commissary production' => ['cm', 'products'],
    'shopping list' => ['shop', 'lines'],
    'suppliers' => ['sup', 'suppliers'],
    'transfer history' => ['hist', 'transfers'],
]);

test('keeps staff without the Inventory area out', function () {
    $this->seed(RoleSeeder::class);

    $response = $this->actingAs(User::factory()->withRole('Branch lead')->for(Branch::factory())->create())->get('/inventory');

    $response->assertForbidden();
});

test('warehouse staff approve and then issue a café\'s request, taking the stock off the warehouse', function () {
    $this->seed(RoleSeeder::class);
    $warehouse = Branch::factory()->warehouse()->create();
    $staff = warehouseStaff($warehouse);
    $milk = WarehouseStock::factory()->for($warehouse)->create(['on_hand' => 26]);
    $transfer = Transfer::factory()->for($warehouse, 'from')->create();
    TransferLine::factory()->for($transfer)->create(['stock_item_id' => $milk->stock_item_id, 'qty' => 12]);

    $this->actingAs($staff)->post("/inventory/transfers/{$transfer->id}/approve")->assertSessionHasNoErrors();
    $this->actingAs($staff)->post("/inventory/transfers/{$transfer->id}/issue")->assertSessionHasNoErrors();

    expect($transfer->fresh())->status->toBe(TransferStatus::InTransit)->approved_by_id->toBe($staff->id)
        ->and($milk->fresh()->on_hand)->toBe('14.000');
});

test('commissary staff can\'t issue the warehouse\'s transfers', function () {
    $this->seed(RoleSeeder::class);
    $transfer = Transfer::factory()->approved()->create();
    $commissaryStaff = User::factory()->withRole('Commissary')->for(Branch::factory()->commissary())->create();

    $response = $this->actingAs($commissaryStaff)->post("/inventory/transfers/{$transfer->id}/issue");

    $response->assertForbidden();
    expect($transfer->fresh()->status)->toBe(TransferStatus::Approved);
});

test('the commissary requests ingredients from the warehouse', function () {
    $this->seed(RoleSeeder::class);
    $commissary = Branch::factory()->commissary()->create();
    $held = WarehouseStock::factory()->create();

    $response = $this->actingAs(User::factory()->withRole('Commissary')->for($commissary)->create())->post("/inventory/locations/{$commissary->id}/requisitions", [
        'from_branch_id' => $held->branch_id,
        'lines' => [['stock_item_id' => $held->stock_item_id, 'qty' => 2.5]],
    ]);

    $response->assertSessionHasNoErrors();
    expect(Transfer::sole())->from_branch_id->toBe($held->branch_id)->to_branch_id->toBe($commissary->id);
});

test('adding an item by an existing SKU links the warehouse to that item', function () {
    $this->seed(RoleSeeder::class);
    $warehouse = Branch::factory()->warehouse()->create();
    $milk = StockItem::factory()->create(['sku' => 'WH-DRY-011', 'name' => 'Fresh milk', 'cost' => 92]);

    $response = $this->actingAs(warehouseStaff($warehouse))->post("/inventory/locations/{$warehouse->id}/items", [
        'name' => 'Fresh milk',
        'sku' => 'wh-dry-011',
        'category' => 'Dairy',
        'unit' => 'L',
        'on_hand' => 26,
        'par' => 40,
        'cost' => 99,
    ]);

    $response->assertSessionHasNoErrors();
    expect(WarehouseStock::sole()->only(['stock_item_id', 'on_hand', 'par']))->toBe(['stock_item_id' => $milk->id, 'on_hand' => '26.000', 'par' => '40.000'])
        ->and(StockItem::count())->toBe(1)
        ->and($milk->fresh()->cost)->toBe('92.00');
});

test('refuses an item the location already stocks', function () {
    $this->seed(RoleSeeder::class);
    $held = WarehouseStock::factory()->create();

    $response = $this->actingAs(warehouseStaff($held->branch))->post("/inventory/locations/{$held->branch_id}/items", [
        'name' => $held->stockItem->name,
        'sku' => $held->stockItem->sku,
        'category' => 'Dairy',
        'unit' => 'L',
        'on_hand' => 1,
        'par' => 1,
        'cost' => 1,
    ]);

    $response->assertSessionHasErrors(['name' => "{$held->stockItem->name} is already on {$held->branch->name}'s list."]);
});

test('editing an item changes the shared item and this location\'s levels', function () {
    $this->seed(RoleSeeder::class);
    $supplier = Supplier::factory()->create();
    $held = WarehouseStock::factory()->create(['on_hand' => 5, 'par' => 6]);

    $this->actingAs(warehouseStaff($held->branch))->put("/inventory/items/{$held->id}", [
        'name' => 'Cocoa powder, Dutch',
        'sku' => $held->stockItem->sku,
        'category' => 'Baking',
        'unit' => 'kg',
        'on_hand' => 5,
        'par' => 8,
        'critical' => 2,
        'cost' => 540,
        'supplier_id' => $supplier->id,
        'pack_name' => 'bag',
        'pack_size' => 5,
    ])->assertSessionHasNoErrors();

    expect($held->stockItem->fresh()->only(['name', 'cost', 'supplier_id', 'pack_name']))
        ->toBe(['name' => 'Cocoa powder, Dutch', 'cost' => '540.00', 'supplier_id' => $supplier->id, 'pack_name' => 'bag'])
        ->and($held->fresh()->only(['par', 'critical']))->toBe(['par' => '8.000', 'critical' => '2.000']);
});

test('staff of another location can\'t change the warehouse\'s stock', function () {
    $this->seed(RoleSeeder::class);
    $held = WarehouseStock::factory()->create(['on_hand' => 5]);

    $response = $this->actingAs(User::factory()->withRole('Commissary')->for(Branch::factory()->commissary())->create())
        ->patch("/inventory/items/{$held->id}/on-hand", ['on_hand' => 50]);

    $response->assertForbidden();
    expect($held->fresh()->on_hand)->toBe('5.000');
});

test('renames a category only on the items this location stocks', function () {
    $this->seed(RoleSeeder::class);
    $held = WarehouseStock::factory()->for(StockItem::factory()->state(['category' => 'Syrup']))->create();
    $elsewhere = StockItem::factory()->create(['category' => 'Syrup']);

    $this->actingAs(warehouseStaff($held->branch))->put("/inventory/locations/{$held->branch_id}/categories", ['from' => 'Syrup', 'to' => 'Syrups']);

    expect($held->stockItem->fresh()->category)->toBe('Syrups')
        ->and($elsewhere->fresh()->category)->toBe('Syrup');
});

test('adds a below-par item to the shopping list topped up to par, once', function () {
    $this->seed(RoleSeeder::class);
    $held = WarehouseStock::factory()->for(StockItem::factory()->state(['name' => 'Caramel syrup', 'unit' => 'btl', 'cost' => 240]))->create(['on_hand' => 4, 'par' => 12]);
    $staff = warehouseStaff($held->branch);

    $this->actingAs($staff)->post('/inventory/shopping-list', ['warehouse_stock_id' => $held->id])->assertSessionHasNoErrors();
    $again = $this->actingAs($staff)->post('/inventory/shopping-list', ['warehouse_stock_id' => $held->id]);

    $again->assertSessionHasErrors(['warehouse_stock_id' => 'Caramel syrup is already on the list.']);
    expect(ShoppingListLine::sole()->only(['name', 'unit', 'cost', 'qty', 'reason']))->toBe([
        'name' => 'Caramel syrup',
        'unit' => 'btl',
        'cost' => '240.00',
        'qty' => '8.000',
        'reason' => "{$held->branch->name} · 4 of 12 par",
    ]);
});

test('removes the selected shopping list lines', function () {
    $this->seed(RoleSeeder::class);
    [$first, $second, $kept] = ShoppingListLine::factory()->count(3)->create();

    $this->actingAs(warehouseStaff())->delete('/inventory/shopping-list', ['ids' => [$first->id, $second->id]]);

    expect(ShoppingListLine::pluck('id')->all())->toBe([$kept->id]);
});

test('a supplier needs a name', function () {
    $this->seed(RoleSeeder::class);

    $response = $this->actingAs(warehouseStaff())->post('/inventory/suppliers', ['contact' => 'Arnel Bituin']);

    $response->assertSessionHasErrors(['name' => 'The name field is required.']);
    $this->assertDatabaseEmpty('suppliers');
});

test('a new product gets the next semi-finished SKU', function () {
    $this->seed(RoleSeeder::class);
    $commissary = Branch::factory()->commissary()->create();
    StockItem::factory()->create(['sku' => 'WH-SEM-001']);

    $this->actingAs(User::factory()->withRole('Commissary')->for($commissary)->create())->post('/inventory/products', [
        'name' => 'Ube halaya filling',
        'servings_per_batch' => 5,
        'stock_per_batch' => 2,
        'unit' => 'kg',
    ])->assertSessionHasNoErrors();

    $product = Product::with('stockItem')->sole();
    expect($product->stockItem->only(['name', 'sku', 'category', 'unit']))
        ->toBe(['name' => 'Ube halaya filling', 'sku' => 'WH-SEM-002', 'category' => 'Semi-finished', 'unit' => 'kg']);
});

test('a product\'s recipe can\'t use the product itself', function () {
    $this->seed(RoleSeeder::class);
    $commissary = Branch::factory()->commissary()->create();
    $product = Product::factory()->create();

    $response = $this->actingAs(User::factory()->withRole('Commissary')->for($commissary)->create())->put("/inventory/products/{$product->id}/recipe", [
        'ingredients' => [['stock_item_id' => $product->stock_item_id, 'qty' => 1]],
    ]);

    $response->assertSessionHasErrors('ingredients.0.stock_item_id');
});

test('the commissary moves a batch along to the warehouse', function () {
    $this->seed(RoleSeeder::class);
    Branch::factory()->warehouse()->create();
    $batch = ProductionBatch::factory()->ready()->create();

    $response = $this->actingAs(User::factory()->withRole('Commissary')->for($batch->branch)->create())->patch("/inventory/batches/{$batch->id}", ['step' => 'deliver']);

    $response->assertSessionHasNoErrors();
    expect($batch->fresh()->transfer_id)->toBe(Transfer::sole()->id);
});

test('the dashboard counts what left the warehouse and arrived in the month', function () {
    $this->seed(RoleSeeder::class);
    $warehouse = Branch::factory()->warehouse()->create();
    $this->travelTo('2026-10-08 10:00:00');
    $delivered = Transfer::factory()->for($warehouse, 'from')->create(['status' => TransferStatus::Received]);
    TransferLine::factory()->for($delivered)->create(['qty' => 12, 'received_at' => now()]);
    TransferLine::factory()->for(Transfer::factory()->inTransit()->for($warehouse, 'from'))->create();

    $response = $this->actingAs(warehouseStaff($warehouse))->get('/inventory?screen=dash&month=2026-10');

    $response->assertInertia(fn (Assert $page) => $page
        ->where('month', '2026-10')
        ->has('delivered', 1)
        ->where('delivered.0.qty', 12));
});
