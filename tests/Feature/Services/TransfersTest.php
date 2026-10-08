<?php

use App\Enums\IssueReason;
use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\TransferLine;
use App\Models\User;
use App\Models\WarehouseStock;
use App\Services\Transfers;
use Illuminate\Validation\ValidationException;

test('issuing takes each line off the source\'s stock', function () {
    $warehouse = Branch::factory()->warehouse()->create();
    $milk = WarehouseStock::factory()->for($warehouse)->create(['on_hand' => 26]);
    $transfer = Transfer::factory()->approved()->for($warehouse, 'from')->create();
    TransferLine::factory()->for($transfer)->create(['stock_item_id' => $milk->stock_item_id, 'qty' => 12]);

    app(Transfers::class)->issue($transfer, User::factory()->create());

    expect($transfer->fresh()->status)->toBe(TransferStatus::InTransit)
        ->and($milk->fresh()->on_hand)->toBe('14.000');
});

test('refuses to issue more than the source holds, and moves nothing', function () {
    $warehouse = Branch::factory()->warehouse()->create();
    $milk = WarehouseStock::factory()->for($warehouse)->for(StockItem::factory()->state(['name' => 'Fresh milk', 'unit' => 'L']))->create(['on_hand' => 26]);
    $syrup = WarehouseStock::factory()->for($warehouse)->for(StockItem::factory()->state(['name' => 'Caramel syrup', 'unit' => 'btl']))->create(['on_hand' => 4]);
    $transfer = Transfer::factory()->approved()->for($warehouse, 'from')->create();
    TransferLine::factory()->for($transfer)->create(['stock_item_id' => $milk->stock_item_id, 'qty' => 12]);
    TransferLine::factory()->for($transfer)->create(['stock_item_id' => $syrup->stock_item_id, 'qty' => 6]);

    expect(fn () => app(Transfers::class)->issue($transfer, User::factory()->create()))
        ->toThrow(ValidationException::class, 'Not enough on hand to send Caramel syrup (4 of 6 btl).');
    expect($milk->fresh()->on_hand)->toBe('26.000')
        ->and($transfer->fresh()->status)->toBe(TransferStatus::Approved);
});

test('receiving one line adds it to the café\'s stock and logs it as received from the warehouse', function () {
    $branch = Branch::factory()->create();
    $warehouse = Branch::factory()->warehouse()->create(['name' => 'Warehouse · Iriga']);
    $milk = StockItem::factory()->create(['cost' => 92]);
    BranchStock::factory()->for($branch)->for($milk)->create(['on_hand' => 9]);
    $transfer = Transfer::factory()->inTransit()->for($warehouse, 'from')->for($branch, 'to')->create();
    $line = TransferLine::factory()->for($transfer)->for($milk)->create(['qty' => 12]);
    TransferLine::factory()->for($transfer)->create();
    $lead = User::factory()->create();

    app(Transfers::class)->receive($transfer, $lead, $line);

    expect($transfer->fresh()->status)->toBe(TransferStatus::PartiallyReceived)
        ->and($line->fresh()->received_by_id)->toBe($lead->id);
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $milk->id, 'on_hand' => 21]);
    $this->assertDatabaseHas('deliveries', ['branch_id' => $branch->id, 'transfer_id' => $transfer->id, 'source' => 'Warehouse · Iriga']);
    $this->assertDatabaseHas('stock_receipts', ['branch_id' => $branch->id, 'stock_item_id' => $milk->id, 'qty' => 12, 'unit_cost' => 92, 'source' => 'Warehouse · Iriga']);
});

test('receiving the rest closes the transfer', function () {
    $transfer = Transfer::factory()->inTransit()->create();
    TransferLine::factory()->for($transfer)->create(['received_at' => now()]);
    TransferLine::factory()->for($transfer)->create();

    app(Transfers::class)->receive($transfer, User::factory()->create());

    expect($transfer->fresh())->status->toBe(TransferStatus::Received)->closed_at->not->toBeNull()
        ->and(TransferLine::whereNull('received_at')->exists())->toBeFalse();
    $this->assertDatabaseCount('stock_receipts', 1);
});

test('an item new to the commissary starts on its list when it is received', function () {
    $commissary = Branch::factory()->commissary()->create();
    $transfer = Transfer::factory()->inTransit()->for($commissary, 'to')->create();
    $line = TransferLine::factory()->for($transfer)->create(['qty' => 7]);

    app(Transfers::class)->receive($transfer, User::factory()->create());

    $this->assertDatabaseHas('warehouse_stock', ['branch_id' => $commissary->id, 'stock_item_id' => $line->stock_item_id, 'on_hand' => 7, 'par' => 4]);
});

test('refuses to receive a transfer that hasn\'t been sent', function () {
    $transfer = Transfer::factory()->approved()->create();
    TransferLine::factory()->for($transfer)->create();

    expect(fn () => app(Transfers::class)->receive($transfer, User::factory()->create()))->toThrow(ValidationException::class);
    $this->assertDatabaseEmpty('stock_receipts');
});

test('a café can only request stock from the warehouse or the commissary, for items they hold', function (Closure $source) {
    $branch = Branch::factory()->create();

    expect(fn () => app(Transfers::class)->requisition($source(), $branch, [StockItem::factory()->create()->id => 2], User::factory()->create()))
        ->toThrow(ValidationException::class);
    $this->assertDatabaseEmpty('transfers');
})->with([
    'another café' => [fn () => Branch::factory()->create()],
    'a warehouse without the item' => [fn () => Branch::factory()->warehouse()->create()],
]);

test('cancelling is refused once the transfer is on its way', function () {
    $transfer = Transfer::factory()->inTransit()->create();

    expect(fn () => app(Transfers::class)->cancel($transfer, User::factory()->create()))
        ->toThrow(ValidationException::class, "{$transfer->number()} is already on its way. It can't be cancelled now.");
});

test('flagging a line again replaces its issue', function () {
    $line = TransferLine::factory()->for(Transfer::factory()->inTransit())->create();
    $transfers = app(Transfers::class);

    $transfers->flag($line, IssueReason::ShortDelivery, null, User::factory()->create());
    $transfers->flag($line, IssueReason::Damaged, '4 of 20 packs crushed', User::factory()->create());

    expect($line->issue()->sole())->reason->toBe(IssueReason::Damaged)->note->toBe('4 of 20 packs crushed');
});

test('receiving a supplier\'s delivery adds to the café\'s stock at the delivered cost', function () {
    $branch = Branch::factory()->create();
    $beans = StockItem::factory()->create(['cost' => 620]);

    app(Transfers::class)->receiveFromSupplier($branch, 'Kalinga Roasters', $beans, 5, 640, User::factory()->create());

    expect($beans->fresh()->cost)->toBe('640.00');
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $beans->id, 'on_hand' => 5]);
    $this->assertDatabaseHas('stock_receipts', ['branch_id' => $branch->id, 'stock_item_id' => $beans->id, 'qty' => 5, 'source' => 'Kalinga Roasters']);
});
