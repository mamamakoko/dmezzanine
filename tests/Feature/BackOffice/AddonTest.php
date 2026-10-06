<?php

use App\Models\StockItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;

test('lets only the Owner edit add-on prices', function (string $role) {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'], $role)->put("/pos/addons/{$till['extraShot']->id}", [
        'name' => 'Extra shot',
        'price' => 50,
        'menu_item_ids' => [$till['latte']->id],
    ]);

    $response->assertForbidden();
    expect($till['extraShot']->fresh()->price)->toBe('35.00');
})->with(['Branch lead', 'Cashier']);

test('lets the Owner edit an add-on\'s price, ingredients and items', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $owner = User::factory()->withRole('Owner')->create();
    $beans = StockItem::factory()->create();

    $response = tillUnlockedFor($owner, $till['branch'])->put("/pos/addons/{$till['extraShot']->id}", [
        'name' => 'Extra shot',
        'price' => 40,
        'parts' => [['stock_item_id' => $beans->id, 'qty' => 0.014]],
        'menu_item_ids' => [$till['latte']->id, $till['espresso']->id],
    ]);

    $response->assertSessionHasNoErrors();
    $addon = $till['extraShot']->fresh(['parts', 'menuItems']);
    expect($addon->price)->toBe('40.00')
        ->and($addon->parts->pluck('id')->all())->toBe([$beans->id])
        ->and($addon->menuItems->pluck('id')->sort()->values()->all())->toBe([$till['latte']->id, $till['espresso']->id]);
    $this->assertDatabaseHas('addon_parts', ['addon_id' => $addon->id, 'stock_item_id' => $beans->id, 'qty' => 0.014]);
});

test('lets a Branch lead switch an add-on off at their own branch only', function () {
    $this->seed(RoleSeeder::class);
    $mine = branchWithMenu();
    $theirs = branchWithMenu();

    $response = unlockedTill($mine['branch'])->put("/pos/addons/{$mine['extraShot']->id}/availability", ['on' => false]);

    $response->assertSessionHasNoErrors();
    expect($mine['branch']->disabledAddons()->pluck('addons.id')->all())->toContain($mine['extraShot']->id)
        ->and($theirs['branch']->disabledAddons()->pluck('addons.id')->all())->not->toContain($mine['extraShot']->id);
});

test('stops a cashier from switching add-ons', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();

    $response = unlockedTill($till['branch'], 'Cashier')->put("/pos/addons/{$till['vanilla']->id}/availability", ['on' => true]);

    $response->assertForbidden();
    expect($till['branch']->disabledAddons()->pluck('addons.id')->all())->toContain($till['vanilla']->id);
});
