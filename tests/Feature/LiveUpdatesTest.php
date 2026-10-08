<?php

use App\Events\MarketingOrderSent;
use App\Events\MarketingOrderUpdated;
use App\Events\MenuAvailabilityChanged;
use App\Events\OrderStatusChanged;
use App\Events\StockCountApproved;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\MarketingOrder;
use App\Models\MarketingOrderLine;
use App\Models\Order;
use App\Models\StockCount;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
});

test('ringing up and moving an order along the queue tells the branch\'s tills, without prices', function () {
    $till = branchWithMenu();
    Event::fake([OrderStatusChanged::class]);

    unlockedTill($till['branch'])->post('/pos/orders', [
        'service' => 'takeout', 'ticket' => 1, 'split' => false, 'payment_method_id' => $till['card']->id,
        'lines' => [['menu_item_id' => $till['espresso']->id, 'qty' => 1]],
    ]);
    $order = Order::sole();
    unlockedTill($till['branch'])->patch("/pos/orders/{$order->id}/status", ['status' => 'ready']);

    Event::assertDispatchedTimes(OrderStatusChanged::class, 2);
    Event::assertDispatched(OrderStatusChanged::class, fn (OrderStatusChanged $event) => $event->status === 'ready'
        && $event->broadcastOn()[0]->name === "private-branch.{$till['branch']->id}"
        && array_keys(get_object_vars($event)) === ['branchId', 'orderId', 'status', 'socket']);
});

test('a marketing order reaches the branch inbox, and the branch\'s reply reaches Marketing', function () {
    $till = branchWithMenu();
    $agent = User::factory()->withRole('Marketing')->create();
    Event::fake([MarketingOrderSent::class, MarketingOrderUpdated::class, OrderStatusChanged::class]);

    $this->actingAs($agent)->post('/marketing/orders', [
        'branch_id' => $till['branch']->id, 'service' => 'pickup', 'customer' => 'Sunrise Dental Clinic', 'wanted_on' => '2026-10-09',
        'lines' => [['menu_item_id' => $till['croissant']->id, 'qty' => 4]],
    ])->assertSessionHasNoErrors();
    unlockedTill($till['branch'])->post('/pos/inbox/'.MarketingOrder::sole()->id.'/accept');

    Event::assertDispatched(MarketingOrderSent::class, fn (MarketingOrderSent $event) => $event->branchId === $till['branch']->id);
    Event::assertDispatched(MarketingOrderUpdated::class, fn (MarketingOrderUpdated $event) => $event->status === 'accepted'
        && $event->broadcastOn()[0]->name === 'private-marketing');
    Event::assertDispatched(OrderStatusChanged::class);
});

test('settling an accepted marketing order tells Marketing', function () {
    $till = branchWithMenu();
    $marketingOrder = MarketingOrder::factory()->for($till['branch'])->create();
    MarketingOrderLine::factory()->for($marketingOrder)->create(['menu_item_id' => $till['croissant']->id, 'name' => 'Butter Croissant', 'qty' => 1, 'addons' => []]);
    unlockedTill($till['branch'])->post("/pos/inbox/{$marketingOrder->id}/accept");
    Event::fake([MarketingOrderUpdated::class]);

    unlockedTill($till['branch'])->post("/pos/orders/{$marketingOrder->fresh()->order_id}/settle", ['split' => false, 'payment_method_id' => $till['card']->id]);

    Event::assertDispatched(MarketingOrderUpdated::class, fn (MarketingOrderUpdated $event) => $event->marketingOrderId === $marketingOrder->id);
});

test('taking an item off the board updates that branch\'s menu', function () {
    $till = branchWithMenu();
    $entry = BranchMenuItem::where('branch_id', $till['branch']->id)->firstOrFail();
    Event::fake([MenuAvailabilityChanged::class]);

    unlockedTill($till['branch'])->patch("/pos/menu/{$entry->id}", ['available' => false]);

    Event::assertDispatchedTimes(MenuAvailabilityChanged::class, 1);
    Event::assertDispatched(MenuAvailabilityChanged::class, fn (MenuAvailabilityChanged $event) => $event->branchId === $till['branch']->id);
});

test('changing a shared add-on updates every café branch\'s menu', function () {
    $till = branchWithMenu();
    $other = Branch::factory()->create();
    Branch::factory()->warehouse()->create();
    Event::fake([MenuAvailabilityChanged::class]);

    tillUnlockedFor(User::factory()->withRole('Owner')->create(), $till['branch'])
        ->put("/pos/addons/{$till['extraShot']->id}", ['name' => 'Extra shot', 'price' => 40])
        ->assertSessionHasNoErrors();

    Event::assertDispatchedTimes(MenuAvailabilityChanged::class, 2);
    Event::assertDispatched(MenuAvailabilityChanged::class, fn (MenuAvailabilityChanged $event) => $event->branchId === $other->id);
});

test('approving a count tells the branch\'s tills their on hand changed', function () {
    $branch = Branch::factory()->create();
    $lead = User::factory()->withRole('Branch lead')->for($branch)->create();
    $sheet = StockCount::factory()->for($branch)->submitted()->create(['day' => '2026-10-07']);
    Event::fake([StockCountApproved::class]);

    $this->actingAs($lead)->post("/stock-report/sheets/{$sheet->id}/approve");

    Event::assertDispatched(StockCountApproved::class, fn (StockCountApproved $event) => $event->branchId === $branch->id && $event->day === '2026-10-07');
});

describe('channel access', function () {
    beforeEach(function () {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb' => ['driver' => 'reverb', 'key' => 'test-key', 'secret' => 'test-secret', 'app_id' => '1', 'options' => []],
        ]);
        app(BroadcastManager::class)->forgetDrivers();
        require base_path('routes/channels.php');
    });

    test('a branch channel is open to that branch\'s staff and the Owner only', function (string $role, bool $sameBranch, int $status) {
        $branch = Branch::factory()->create();
        $user = User::factory()->withRole($role)->for($sameBranch ? $branch : Branch::factory())->create();

        $this->actingAs($user)
            ->post('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => "private-branch.{$branch->id}"])
            ->assertStatus($status);
    })->with([
        'its cashier' => ['Cashier', true, 200],
        'another branch\'s lead' => ['Branch lead', false, 403],
        'the Owner' => ['Owner', false, 200],
    ]);

    test('the marketing channel is open to Marketing only', function (string $role, int $status) {
        $this->actingAs(User::factory()->withRole($role)->create())
            ->post('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'private-marketing'])
            ->assertStatus($status);
    })->with([
        'a marketing agent' => ['Marketing', 200],
        'a cashier' => ['Cashier', 403],
    ]);
});
