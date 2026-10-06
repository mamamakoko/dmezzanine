<?php

use App\Models\BranchMenuItem;
use App\Models\Category;
use App\Models\StockItem;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * A blank PNG of the given size, built without GD so the test runs wherever PHP does.
 */
function blankPng(int $width, int $height): UploadedFile
{
    $chunk = fn (string $type, string $data) => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
    $rows = str_repeat("\0".str_repeat("\0", $width), $height);
    $png = "\x89PNG\r\n\x1a\n"
        .$chunk('IHDR', pack('NNCCCCC', $width, $height, 8, 0, 0, 0, 0))
        .$chunk('IDAT', gzcompress($rows))
        .$chunk('IEND', '');

    return UploadedFile::fake()->createWithContent('photo.png', $png);
}

test('lets a Branch lead take an item off their own board', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $entry = $till['branch']->menuEntries()->where('menu_item_id', $till['latte']->id)->sole();

    unlockedTill($till['branch'])->patch("/pos/menu/{$entry->id}", ['available' => false]);

    expect($entry->fresh()->available)->toBeFalse();
});

test('stops a Branch lead from changing another branch\'s menu', function () {
    $this->seed(RoleSeeder::class);
    $mine = branchWithMenu();
    $theirs = branchWithMenu();
    $theirEntry = $theirs['branch']->menuEntries()->firstOrFail();
    $theirCategory = $theirs['branch']->categories()->firstOrFail();

    unlockedTill($mine['branch'])->patch("/pos/menu/{$theirEntry->id}", ['available' => false])->assertNotFound();
    unlockedTill($mine['branch'])->patch("/pos/categories/{$theirCategory->id}", ['name' => 'Renamed'])->assertNotFound();

    expect($theirEntry->fresh()->available)->toBeTrue()
        ->and($theirCategory->fresh()->name)->not->toBe('Renamed');
});

test('refuses a category from another branch for an item here', function () {
    $this->seed(RoleSeeder::class);
    $mine = branchWithMenu();
    $theirs = branchWithMenu();
    $entry = $mine['branch']->menuEntries()->firstOrFail();

    $response = unlockedTill($mine['branch'])->patch("/pos/menu/{$entry->id}", ['category_id' => $theirs['branch']->categories()->value('id')]);

    $response->assertSessionHasErrors(['category_id']);
});

test('lets only the Owner change a shared menu item', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $category = $till['branch']->categories()->firstOrFail();
    $payload = ['name' => 'Cafe Latte', 'price' => 150, 'category_id' => $category->id];

    unlockedTill($till['branch'])->put("/pos/menu-items/{$till['latte']->id}", $payload)->assertForbidden();

    expect($till['latte']->fresh()->price)->toBe('140.00');
});

test('lets the Owner change an item\'s price, recipe and add-ons, and its category here', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $owner = User::factory()->withRole('Owner')->create();
    $drinks = Category::factory()->for($till['branch'])->create(['name' => 'Drinks']);
    $beans = StockItem::factory()->create();

    $response = tillUnlockedFor($owner, $till['branch'])->put("/pos/menu-items/{$till['latte']->id}", [
        'name' => 'Cafe Latte',
        'price' => 150,
        'note' => 'Steamed milk',
        'has_modifiers' => true,
        'category_id' => $drinks->id,
        'recipe' => [['stock_item_id' => $beans->id, 'qty' => 0.018]],
        'addon_ids' => [$till['extraShot']->id],
    ]);

    $response->assertSessionHasNoErrors();
    $latte = $till['latte']->fresh(['ingredients', 'addons']);
    expect($latte->price)->toBe('150.00')
        ->and($latte->ingredients->pluck('id')->all())->toBe([$beans->id])
        ->and($latte->addons->pluck('id')->all())->toBe([$till['extraShot']->id]);
    $this->assertDatabaseHas('recipes', ['menu_item_id' => $latte->id, 'stock_item_id' => $beans->id, 'qty' => 0.018]);
    $this->assertDatabaseHas('branch_menu_items', ['branch_id' => $till['branch']->id, 'menu_item_id' => $latte->id, 'category_id' => $drinks->id]);
});

test('stores a menu photo in public storage', function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('public');
    $till = branchWithMenu();
    $owner = User::factory()->withRole('Owner')->create();

    tillUnlockedFor($owner, $till['branch'])->post("/pos/menu-items/{$till['latte']->id}/photo", ['photo' => blankPng(800, 450)]);

    $path = $till['latte']->fresh()->photo_path;
    expect($path)->toStartWith('menu-photos/');
    Storage::disk('public')->assertExists($path);
});

test('refuses a menu photo smaller than 800×450', function () {
    $this->seed(RoleSeeder::class);
    Storage::fake('public');
    $till = branchWithMenu();
    $owner = User::factory()->withRole('Owner')->create();

    $response = tillUnlockedFor($owner, $till['branch'])->post("/pos/menu-items/{$till['latte']->id}/photo", ['photo' => blankPng(640, 360)]);

    $response->assertSessionHasErrors(['photo' => 'The photo needs to be at least 800×450.']);
    expect($till['latte']->fresh()->photo_path)->toBeNull();
});

test('keeps a category that still has items', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $category = $till['branch']->categories()->firstOrFail();

    $response = unlockedTill($till['branch'])->delete("/pos/categories/{$category->id}");

    $response->assertSessionHasErrors(['category']);
    $this->assertModelExists($category);
});

test('puts an existing item on this branch\'s menu', function () {
    $this->seed(RoleSeeder::class);
    $till = branchWithMenu();
    $till['branch']->menuEntries()->where('menu_item_id', $till['espresso']->id)->delete();

    unlockedTill($till['branch'])->post('/pos/menu', [
        'menu_item_id' => $till['espresso']->id,
        'category_id' => $till['branch']->categories()->value('id'),
    ]);

    expect(BranchMenuItem::where('branch_id', $till['branch']->id)->where('menu_item_id', $till['espresso']->id)->exists())->toBeTrue();
});
