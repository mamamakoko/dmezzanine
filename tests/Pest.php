<?php

use App\Enums\PaymentMethodKind;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\PaymentMethod;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind a different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Sign in as a staff member of the branch and unlock its till for them, as a PIN unlock would.
 */
function unlockedTill(Branch $branch, string $role = 'Branch lead'): TestCase
{
    return tillUnlockedFor(User::factory()->withRole($role)->for($branch)->create(), $branch);
}

/**
 * Sign in on the branch's till and unlock it for a given staff member, such as the Owner, whose PIN
 * opens any branch's till.
 */
function tillUnlockedFor(User $staff, Branch $branch): TestCase
{
    $account = $staff->branch_id === $branch->id ? $staff : User::factory()->withRole('Cashier')->for($branch)->create();

    return test()->actingAs($account)->withSession(['pos' => ['branch_id' => $branch->id, 'staff_id' => $staff->id]]);
}

/**
 * A café branch with a small menu and the default payment methods: a ₱140 latte that offers an Extra
 * shot (₱35) and Vanilla (₱20, switched off at this branch), a ₱60 croissant, and a ₱95 espresso.
 *
 * @return array{branch: Branch, latte: MenuItem, croissant: MenuItem, espresso: MenuItem, extraShot: Addon, vanilla: Addon, cash: PaymentMethod, card: PaymentMethod, ewallet: PaymentMethod, payLater: PaymentMethod}
 */
function branchWithMenu(): array
{
    $branch = Branch::factory()->create();
    $category = Category::factory()->for($branch)->create();

    // The menu and add-ons are shared by every branch, so a second branch reuses them.
    $latte = MenuItem::firstOrCreate(['name' => 'Cafe Latte'], ['price' => 140, 'has_modifiers' => true]);
    $croissant = MenuItem::firstOrCreate(['name' => 'Butter Croissant'], ['price' => 60]);
    $espresso = MenuItem::firstOrCreate(['name' => 'Espresso'], ['price' => 95]);

    foreach ([$latte, $croissant, $espresso] as $item) {
        BranchMenuItem::factory()->for($branch)->for($item)->for($category)->create();
    }

    $extraShot = Addon::firstOrCreate(['name' => 'Extra shot'], ['price' => 35]);
    $vanilla = Addon::firstOrCreate(['name' => 'Vanilla'], ['price' => 20]);
    $latte->addons()->syncWithoutDetaching([$extraShot->id, $vanilla->id]);
    $branch->disabledAddons()->attach($vanilla);

    return [
        'branch' => $branch,
        'latte' => $latte,
        'croissant' => $croissant,
        'espresso' => $espresso,
        'extraShot' => $extraShot,
        'vanilla' => $vanilla,
        'cash' => PaymentMethod::factory()->for($branch)->create(['name' => 'Cash', 'kind' => PaymentMethodKind::Cash]),
        'card' => PaymentMethod::factory()->for($branch)->create(['name' => 'Card', 'kind' => PaymentMethodKind::Card]),
        'ewallet' => PaymentMethod::factory()->for($branch)->create(['name' => 'E-wallet', 'kind' => PaymentMethodKind::Qr]),
        'payLater' => PaymentMethod::factory()->for($branch)->tab()->create(['name' => 'Pay later']),
    ];
}
