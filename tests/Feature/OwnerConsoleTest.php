<?php

use App\Enums\BranchKind;
use App\Enums\BranchStatus;
use App\Enums\PaymentMethodKind;
use App\Enums\PermissionArea;
use App\Enums\Station;
use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\BranchStockItem;
use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\StockCount;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->owner = User::factory()->withRole('Owner')->create();
});

test('keeps the Owner console from staff without it', function () {
    $cashier = User::factory()->withRole('Cashier')->create();

    $this->actingAs($cashier)->get('/owner')->assertForbidden();
    $this->actingAs($cashier)->post('/owner/users', [])->assertForbidden();
});

test('invites a user with a first-time password and till PIN shown once', function () {
    $branch = Branch::factory()->create();
    $cashier = Role::where('name', 'Cashier')->value('id');

    $response = $this->actingAs($this->owner)->post('/owner/users', [
        'name' => 'Paolo Rivas', 'email' => ' Paolo@Dmezzanine.ph ', 'role_id' => $cashier, 'branch_id' => $branch->id,
    ]);

    $issued = $response->assertSessionHasNoErrors()->assertSessionHas('issued')->getSession()->get('issued');
    $user = User::where('email', 'paolo@dmezzanine.ph')->sole();
    expect($user)->active->toBeTrue()->branch_id->toBe($branch->id)->last_login_at->toBeNull()
        ->and(Hash::check($issued['password'], $user->password))->toBeTrue()
        ->and(Hash::check($issued['pin'], $user->pin_hash))->toBeTrue()
        ->and($issued['pin'])->toMatch('/^\d{4}$/');
    $this->assertDatabaseHas('activity_logs', ['what' => 'Invite sent', 'user_id' => $this->owner->id]);
});

test('refuses an invite for an email someone already has', function () {
    User::factory()->create(['email' => 'joy@dmezzanine.ph']);

    $response = $this->actingAs($this->owner)->post('/owner/users', [
        'name' => 'Joy', 'email' => 'JOY@dmezzanine.ph', 'role_id' => Role::where('name', 'Cashier')->value('id'),
    ]);

    $response->assertSessionHasErrors(['email' => 'Someone already has that email.']);
});

test('lets only the Owner make someone an Owner', function () {
    $manager = User::factory()->withRole('Branch lead')->create();
    $manager->permissionOverrides()->create(['area' => 'owner', 'allowed' => true]);
    $owner = Role::where('name', 'Owner')->value('id');

    $this->actingAs($manager)->post('/owner/users', ['name' => 'Rico', 'email' => 'rico@dmezzanine.ph', 'role_id' => $owner])->assertForbidden();
    $this->actingAs($manager)->put("/owner/users/{$this->owner->id}", ['name' => 'Renamed', 'email' => $this->owner->email, 'role_id' => $owner])->assertForbidden();
    $this->assertDatabaseMissing('users', ['email' => 'rico@dmezzanine.ph']);
});

test('keeps at least one active Owner', function () {
    $response = $this->actingAs($this->owner)->put("/owner/users/{$this->owner->id}", [
        'name' => $this->owner->name, 'email' => $this->owner->email, 'role_id' => Role::where('name', 'Cashier')->value('id'),
    ]);

    $response->assertSessionHasErrors(['role_id' => 'Keep at least one active Owner. Make someone else an Owner first.']);
    expect($this->owner->fresh()->isOwner())->toBeTrue();
});

test('revoking access signs the user out and closes the pages to them', function () {
    config(['session.driver' => 'database']);
    $lead = User::factory()->withRole('Branch lead')->create();
    DB::table('sessions')->insert(['id' => 'lead-session', 'user_id' => $lead->id, 'payload' => '', 'last_activity' => time()]);

    $this->actingAs($this->owner)->patch("/owner/users/{$lead->id}/access")->assertSessionHasNoErrors();

    expect($lead->fresh()->active)->toBeFalse();
    $this->assertDatabaseMissing('sessions', ['id' => 'lead-session']);
    $this->actingAs($lead->fresh())->get('/stock-count')->assertForbidden();
});

test('no one can switch off their own access', function () {
    $this->actingAs($this->owner)->patch("/owner/users/{$this->owner->id}/access")->assertForbidden();

    expect($this->owner->fresh()->active)->toBeTrue();
});

test('issues a new till PIN that unlocks only for that user', function () {
    $branch = Branch::factory()->create();
    $cashier = User::factory()->withRole('Cashier')->for($branch)->create(['pin_hash' => '1234']);

    $response = $this->actingAs($this->owner)->post("/owner/users/{$cashier->id}/credentials", ['type' => 'pin']);

    $issued = $response->getSession()->get('issued');
    expect($issued['password'])->toBeNull()
        ->and(Hash::check($issued['pin'], $cashier->fresh()->pin_hash))->toBeTrue()
        ->and(Hash::check('1234', $cashier->fresh()->pin_hash))->toBeFalse();
});

test('keeps a page change as an exception only while it differs from the role', function () {
    $cashier = User::factory()->withRole('Cashier')->create();

    $this->actingAs($this->owner)->put("/owner/users/{$cashier->id}/pages/sales", ['allowed' => true]);
    expect($cashier->fresh()->canAccess(PermissionArea::Sales))->toBeTrue();

    $this->actingAs($this->owner)->put("/owner/users/{$cashier->id}/pages/sales", ['allowed' => false]);
    expect($cashier->permissionOverrides()->count())->toBe(0);
});

test('the Owner keeps every page', function () {
    $this->actingAs($this->owner)->put("/owner/users/{$this->owner->id}/pages/owner", ['allowed' => false])->assertForbidden();
});

test('a new café branch starts with a copy of the first branch\'s menu, payment methods and count list', function () {
    $first = Branch::factory()->create();
    $category = Category::factory()->for($first)->create(['name' => 'Espresso']);
    $entry = BranchMenuItem::factory()->for($first)->for($category)->create();
    PaymentMethod::factory()->for($first)->create(['name' => 'Cash', 'kind' => PaymentMethodKind::Cash]);
    $rosterItem = BranchStockItem::factory()->for($first)->create(['station' => Station::Bar]);

    $this->actingAs($this->owner)->post('/owner/locations', ['kind' => 'branch', 'name' => 'DMC-Naga Branch', 'address' => 'Naga City'])
        ->assertSessionHasNoErrors();

    $naga = Branch::where('name', 'DMC-Naga Branch')->sole();
    $nagaCategory = $naga->categories()->sole();
    expect($nagaCategory->name)->toBe('Espresso')
        ->and($naga->menuEntries()->sole()->only(['menu_item_id', 'category_id']))->toBe(['menu_item_id' => $entry->menu_item_id, 'category_id' => $nagaCategory->id])
        ->and($naga->paymentMethods()->pluck('name')->all())->toBe(['Cash'])
        ->and($naga->stockItems()->sole()->stock_item_id)->toBe($rosterItem->stock_item_id);
});

test('refuses a second warehouse', function () {
    Branch::factory()->warehouse()->create();

    $this->actingAs($this->owner)->post('/owner/locations', ['kind' => 'warehouse', 'name' => 'Warehouse · Naga'])
        ->assertSessionHasErrors(['kind' => 'There is already a warehouse. Add a café branch instead.']);
    expect(Branch::where('kind', BranchKind::Warehouse)->count())->toBe(1);
});

test('archives a location and names its manager', function () {
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();

    $this->actingAs($this->owner)->put("/owner/locations/{$branch->id}", ['name' => $branch->name, 'manager_id' => $lead->id, 'status' => 'archived']);

    expect($branch->fresh())->status->toBe(BranchStatus::Archived)->manager_id->toBe($lead->id);
});

test('the activity log shows console changes, sign-ins and submitted counts, filtered by date', function () {
    $branch = Branch::factory()->create();
    $this->travelTo('2026-10-07 02:00:00');
    StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07', 'submitted_at' => now(), 'submitted_by_id' => $this->owner->id]);
    $this->travelTo('2026-10-08 02:00:00');
    event(new Login('web', $this->owner, false));

    $this->actingAs($this->owner)->get('/owner?screen=log&from=2026-10-08&to=2026-10-08')
        ->assertInertia(fn (Assert $page) => $page
            ->has('log.entries', 1)
            ->where('log.entries.0.what', 'Signed in')
            ->where('log.entries.0.who', $this->owner->name));

    $this->actingAs($this->owner)->get('/owner?screen=log')
        ->assertInertia(fn (Assert $page) => $page->where('log.entries.1.kind', 'count')->where('log.entries.1.source', 'Stock count'));
    expect($this->owner->fresh()->last_login_at->toDateTimeString())->toBe('2026-10-08 02:00:00')
        ->and(ActivityLog::count())->toBe(1);
});
