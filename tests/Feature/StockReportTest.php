<?php

use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\StockCount;
use App\Models\StockCountLine;
use App\Models\StockItem;
use App\Models\StockReceipt;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('approving a day posts its endings as the branch\'s on hand', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $counter = User::factory()->withRole('Branch lead')->for($branch)->create();
    $sheet = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07', 'submitted_by_id' => $counter->id]);
    $milk = StockCountLine::factory()->for($sheet)->create(['counted' => 9, 'adjusted' => 8]);
    $beans = StockCountLine::factory()->for($sheet)->create(['counted' => 2.5]);

    $response = $this->actingAs($lead)->post("/stock-report/sheets/{$sheet->id}/approve");

    $response->assertSessionHasNoErrors();
    expect($sheet->fresh())->status->toBe(StockCountStatus::Approved)->reviewed_by_id->toBe($lead->id);
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $milk->stock_item_id, 'on_hand' => 8, 'counted_by_id' => $counter->id]);
    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $beans->stock_item_id, 'on_hand' => 2.5]);
});

test('approving an older day keeps a newer approved figure', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $milk = StockItem::factory()->create();
    $onHand = BranchStock::factory()->for($branch)->for($milk)->create(['on_hand' => 12, 'counted_on' => '2026-10-08']);
    $olderSheet = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07']);
    StockCountLine::factory()->for($olderSheet)->for($milk)->create(['counted' => 3]);

    $this->actingAs($lead)->post("/stock-report/sheets/{$olderSheet->id}/approve");

    expect($onHand->fresh())->on_hand->toBe('12.000')->counted_on->toDateString()->toBe('2026-10-08');
});

test('approving a day adds stock received after it to the counted ending', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $milk = StockItem::factory()->create();
    $sheet = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07']);
    StockCountLine::factory()->for($sheet)->for($milk)->create(['counted' => 3]);
    StockReceipt::factory()->for($branch)->for($milk)->create(['day' => '2026-10-07', 'qty' => 6]);
    StockReceipt::factory()->for($branch)->for($milk)->create(['day' => '2026-10-08', 'qty' => 12]);

    $this->actingAs($lead)->post("/stock-report/sheets/{$sheet->id}/approve");

    $this->assertDatabaseHas('branch_stock', ['branch_id' => $branch->id, 'stock_item_id' => $milk->id, 'on_hand' => 15]);
});

test('lets the manager correct an ending and flag an item while the day is under review', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $line = StockCountLine::factory()->for(StockCount::factory()->for($branch)->submitted())->create(['counted' => 9]);

    $this->actingAs($lead)->patch("/stock-report/lines/{$line->id}", ['adjusted' => 7.5, 'mark' => 'flag', 'note' => 'Spillage at close']);

    expect($line->fresh()->only(['counted', 'adjusted', 'note']))->toBe(['counted' => '9.000', 'adjusted' => '7.500', 'note' => 'Spillage at close']);
});

test('refuses changes to a signed-off day until it is reopened', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $sheet = StockCount::factory()->for($branch)->approved()->create();
    $line = StockCountLine::factory()->for($sheet)->create(['counted' => 9]);

    $this->actingAs($lead)->patch("/stock-report/lines/{$line->id}", ['adjusted' => 1])
        ->assertSessionHasErrors(['sheet' => 'This sheet is signed off. Reopen the review to change it.']);
    $this->actingAs($lead)->post("/stock-report/sheets/{$sheet->id}/reopen");
    $this->actingAs($lead)->patch("/stock-report/lines/{$line->id}", ['adjusted' => 1])->assertSessionHasNoErrors();

    expect($sheet->fresh()->status)->toBe(StockCountStatus::Submitted)
        ->and($line->fresh()->adjusted)->toBe('1.000');
});

test('stops managers of other branches from signing a day off', function () {
    $this->seed(RoleSeeder::class);
    $sheet = StockCount::factory()->for(Branch::factory())->submitted()->create();
    $otherLead = User::factory()->withRole('Branch lead')->for(Branch::factory())->create();

    $response = $this->actingAs($otherLead)->post("/stock-report/sheets/{$sheet->id}/approve");

    $response->assertNotFound();
    expect($sheet->fresh()->status)->toBe(StockCountStatus::Submitted);
});

test('returns a day for re-count without posting on hand', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $owner = User::factory()->withRole('Owner')->create();
    $sheet = StockCount::factory()->for($branch)->submitted()->create();
    StockCountLine::factory()->for($sheet)->create();

    $this->actingAs($owner)->post("/stock-report/sheets/{$sheet->id}/return");

    expect($sheet->fresh()->status)->toBe(StockCountStatus::Returned);
    $this->assertDatabaseEmpty('branch_stock');
});

test('shows the latest submitted day for review, signable by the branch lead', function () {
    $this->seed(RoleSeeder::class);
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    StockCount::factory()->for($branch)->approved()->create(['day' => '2026-10-06']);
    $latest = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07']);
    StockCountLine::factory()->for($latest)->create(['counted' => 4]);
    StockCount::factory()->for($branch)->create(['day' => '2026-10-08']);

    $response = $this->actingAs($lead)->get('/stock-report');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('stock-report')
        ->where('canSign', true)
        ->where('days', [['day' => '2026-10-07', 'status' => 'submitted'], ['day' => '2026-10-06', 'status' => 'approved']])
        ->where('dayReport.sheet.id', $latest->id)
        ->where('dayReport.rows.0.counted', 4)
        ->where('monthReport.month', '2026-10')
    );
});

test('lets the Owner open any branch\'s report, and keeps branch leads to their own', function () {
    $this->seed(RoleSeeder::class);
    [$iriga, $naga] = Branch::factory()->count(2)->create();
    $owner = User::factory()->withRole('Owner')->create();
    $lead = User::factory()->withRole('Branch lead')->for($iriga)->create();

    $this->actingAs($owner)->get("/stock-report?branch={$naga->id}")->assertInertia(fn (Assert $page) => $page->where('branch.id', $naga->id));
    $this->actingAs($lead)->get("/stock-report?branch={$naga->id}")->assertInertia(fn (Assert $page) => $page->where('branch.id', $iriga->id));
});
