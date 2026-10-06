<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\StockItem;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    /**
     * CATS from the Branch Menu prototype, in till order.
     *
     * @var list<string>
     */
    public const CATEGORIES = ['Espresso', 'Non-Coffee', 'Frappe', 'Pastries', 'Rice Meals'];

    /**
     * MENU from the Branch Menu prototype: [name, price, category, note, asks for size/milk/add-ons].
     *
     * @var list<array{0: string, 1: int, 2: string, 3: string, 4: bool}>
     */
    public const ITEMS = [
        ['Americano', 110, 'Espresso', 'Double shot, hot or iced', true],
        ['Espresso', 95, 'Espresso', 'Kalinga single origin', false],
        ['Cafe Latte', 140, 'Espresso', 'Steamed milk, light foam', true],
        ['Cappuccino', 140, 'Espresso', 'Dry foam, cocoa dust', true],
        ['Spanish Latte', 155, 'Espresso', 'Condensed milk', true],
        ['Cafe Mocha', 160, 'Espresso', 'Dark chocolate', true],
        ['Matcha Latte', 165, 'Non-Coffee', 'Ceremonial grade', true],
        ['Hot Chocolate', 130, 'Non-Coffee', '70% tablea', true],
        ['Strawberry Milk', 145, 'Non-Coffee', 'Fresh puree', true],
        ['Lemon Iced Tea', 95, 'Non-Coffee', 'Bottomless refill', false],
        ['Java Chip', 175, 'Frappe', 'Blended, cookie crumb', true],
        ['Caramel Frappe', 170, 'Frappe', 'Salted caramel drizzle', true],
        ['Matcha Frappe', 180, 'Frappe', 'Blended with oat', true],
        ['Butter Croissant', 95, 'Pastries', 'Baked 6am daily', false],
        ['Cinnamon Roll', 105, 'Pastries', 'Cream cheese glaze', false],
        ['Banana Bread', 85, 'Pastries', 'Walnut top', false],
        ['Ube Cheese Pandesal', 90, 'Pastries', 'Two pieces', false],
        ['Chicken Adobo Rice', 185, 'Rice Meals', 'Garlic rice, egg', false],
        ['Beef Tapa Rice', 195, 'Rice Meals', 'Atchara on the side', false],
        ['Pork Sisig Rice', 205, 'Rice Meals', 'Calamansi, chili', false],
        ['Tocino Rice', 175, 'Rice Meals', 'Sweet cured pork', false],
    ];

    /**
     * RECIPE from the Branch Menu prototype, keyed by menu item name: stock SKU => quantity per serving.
     *
     * @var array<string, array<string, float>>
     */
    public const RECIPES = [
        'Americano' => ['WH-COF-001' => 0.018, 'WH-PKG-021' => 1],
        'Espresso' => ['WH-COF-001' => 0.014],
        'Cafe Latte' => ['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.22, 'WH-PKG-021' => 1],
        'Cappuccino' => ['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.18, 'WH-PKG-021' => 1],
        'Spanish Latte' => ['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.2, 'WH-PKG-021' => 1],
        'Cafe Mocha' => ['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.2, 'WH-BAK-009' => 0.02],
        'Matcha Latte' => ['WH-DRY-024' => 6, 'WH-DRY-011' => 0.22, 'WH-PKG-021' => 1],
        'Hot Chocolate' => ['WH-BAK-009' => 0.025, 'WH-DRY-011' => 0.24],
        'Java Chip' => ['WH-COF-001' => 0.02, 'WH-DRY-011' => 0.2, 'WH-PKG-021' => 1, 'WH-PKG-022' => 1],
        'Caramel Frappe' => ['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.2, 'WH-SYR-002' => 0.05, 'WH-PKG-021' => 1],
        'Matcha Frappe' => ['WH-DRY-024' => 7, 'WH-DRY-018' => 0.22, 'WH-PKG-021' => 1, 'WH-PKG-022' => 1],
        'Butter Croissant' => ['WH-BAK-001' => 0.09, 'WH-BAK-006' => 0.04],
        'Chicken Adobo Rice' => ['WH-KIT-020' => 0.18],
        'Pork Sisig Rice' => ['WH-KIT-020' => 0.18, 'WH-KIT-022' => 0.16],
        'Tocino Rice' => ['WH-KIT-020' => 0.18, 'WH-KIT-022' => 0.12],
    ];

    /**
     * Seed the shared menu and recipes, then give every café branch its own categories and menu.
     */
    public function run(): void
    {
        $stockIds = StockItem::pluck('id', 'sku');
        $menuItems = collect();

        foreach (self::ITEMS as [$name, $price, , $note, $hasModifiers]) {
            $menuItem = MenuItem::updateOrCreate(
                ['name' => $name],
                ['price' => $price, 'note' => $note, 'has_modifiers' => $hasModifiers],
            );

            $menuItem->ingredients()->sync(
                collect(self::RECIPES[$name] ?? [])
                    ->mapWithKeys(fn (float $qty, string $sku) => [$stockIds[$sku] => ['qty' => $qty]])
                    ->all(),
            );

            $menuItems[$name] = $menuItem;
        }

        Branch::where('kind', BranchKind::Branch)->each(function (Branch $branch) use ($menuItems) {
            $categories = collect(self::CATEGORIES)->mapWithKeys(fn (string $name, int $sort) => [
                $name => $branch->categories()->updateOrCreate(['name' => $name], ['sort' => $sort]),
            ]);

            foreach (self::ITEMS as $sort => [$name, , $category]) {
                $branch->menuEntries()->updateOrCreate(
                    ['menu_item_id' => $menuItems[$name]->id],
                    ['category_id' => $categories[$category]->id, 'available' => true, 'sort' => $sort],
                );
            }
        });
    }
}
