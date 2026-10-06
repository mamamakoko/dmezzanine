<?php

use App\Enums\BranchKind;
use App\Enums\PaymentMethodKind;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\MenuItem;
use App\Models\PaymentMethod;
use App\Models\Role;
use App\Models\StockItem;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

test('seeds the warehouse, commissary and two café branches', function () {
    $this->seed();

    expect(Branch::orderBy('id')->get()->map(fn (Branch $branch) => [$branch->name, $branch->kind])->all())->toBe([
        ['Warehouse · Iriga', BranchKind::Warehouse],
        ['Commissary', BranchKind::Commissary],
        ['DMC-Iriga Branch', BranchKind::Branch],
        ['DMC-Naga Branch', BranchKind::Branch],
    ]);
});

test('seeds demo users with their role, location, password and PIN', function () {
    $this->seed();

    $users = User::with(['role', 'branch'])->orderBy('id')->get();

    expect($users->map(fn (User $user) => [$user->email, $user->role->name, $user->branch?->name])->all())->toBe([
        ['rico@dmezzanine.ph', 'Owner', null],
        ['marisol@dmezzanine.ph', 'Warehouse', 'Warehouse · Iriga'],
        ['deng@dmezzanine.ph', 'Commissary', 'Commissary'],
        ['joy@dmezzanine.ph', 'Branch lead', 'DMC-Iriga Branch'],
        ['paolo@dmezzanine.ph', 'Cashier', 'DMC-Iriga Branch'],
    ]);
    $users->each(function (User $user) {
        expect(Hash::check('dmezzanine', $user->password))->toBeTrue()
            ->and(Hash::check('1234', $user->pin_hash))->toBeTrue()
            ->and($user->active)->toBeTrue();
    });
});

test('gives each role its default page access', function (string $role, array $allowedAreas) {
    $this->seed();

    $permissions = Role::firstWhere('name', $role)->permissions;

    expect($permissions)->toHaveCount(8)
        ->and($permissions->where('allowed', true)->pluck('area.value')->sort()->values()->all())->toBe($allowedAreas);
})->with([
    'owner' => ['Owner', ['count', 'inventory', 'marketing', 'menu', 'owner', 'pos', 'report', 'sales']],
    'branch lead' => ['Branch lead', ['count', 'marketing', 'menu', 'pos', 'report', 'sales']],
    'cashier' => ['Cashier', ['menu', 'pos']],
    'warehouse' => ['Warehouse', ['inventory']],
    'commissary' => ['Commissary', ['inventory']],
    'marketing' => ['Marketing', ['marketing']],
]);

test('seeds the 32 warehouse stock items', function () {
    $this->seed();

    expect(StockItem::count())->toBe(32)
        ->and(StockItem::firstWhere('sku', 'WH-DRY-024'))
        ->name->toBe('Matcha powder')
        ->unit->toBe('g')
        ->cost->toBe('4.20')
        ->par->toBe('800.000');
});

test('seeds menu items with their recipes', function () {
    $this->seed();

    $latte = MenuItem::firstWhere('name', 'Cafe Latte');

    expect(MenuItem::count())->toBe(21)
        ->and($latte->price)->toBe('140.00')
        ->and($latte->has_modifiers)->toBeTrue()
        ->and($latte->ingredients->mapWithKeys(fn (StockItem $item) => [$item->sku => (float) $item->pivot->qty])->all())
        ->toEqualCanonicalizing(['WH-COF-001' => 0.018, 'WH-DRY-011' => 0.22, 'WH-PKG-021' => 1.0]);
});

test('gives every café branch its own categories and full menu', function () {
    $this->seed();

    Branch::where('kind', BranchKind::Branch)->get()->each(function (Branch $branch) {
        $entries = $branch->menuEntries()->with(['menuItem', 'category'])->get();

        expect($branch->categories()->orderBy('sort')->pluck('name')->all())
            ->toBe(['Espresso', 'Non-Coffee', 'Frappe', 'Pastries', 'Rice Meals'])
            ->and($entries)->toHaveCount(21)
            ->and($entries->every('available'))->toBeTrue()
            ->and($entries->firstWhere('menuItem.name', 'Matcha Frappe')->category->name)->toBe('Frappe')
            ->and($entries->pluck('category.branch_id')->unique()->all())->toBe([$branch->id]);
    });
});

test('does not give the warehouse or commissary a menu or payment methods', function () {
    $this->seed();

    Branch::where('kind', '!=', BranchKind::Branch)->get()->each(function (Branch $branch) {
        expect($branch->categories()->exists())->toBeFalse()
            ->and($branch->menuEntries()->exists())->toBeFalse()
            ->and($branch->paymentMethods()->exists())->toBeFalse();
    });
});

test('offers add-ons on every item that asks for modifiers', function () {
    $this->seed();

    $extraShot = Addon::firstWhere('name', 'Extra shot');

    expect(Addon::orderBy('id')->pluck('price', 'name')->all())
        ->toBe(['Extra shot' => '35.00', 'Vanilla' => '20.00', 'Whipped cream' => '25.00', 'Decaf' => '0.00'])
        ->and($extraShot->menuItems)->toHaveCount(11)
        ->and($extraShot->menuItems->every('has_modifiers'))->toBeTrue()
        ->and($extraShot->parts->sole()->sku)->toBe('WH-COF-001')
        ->and((float) $extraShot->parts->sole()->pivot->qty)->toBe(0.014);
});

test('gives every café branch the four default payment methods', function () {
    $this->seed();

    Branch::where('kind', BranchKind::Branch)->get()->each(function (Branch $branch) {
        $methods = $branch->paymentMethods()->orderBy('id')->get();
        $payLater = $methods->firstWhere('name', 'Pay later');

        expect($methods->map(fn (PaymentMethod $method) => [$method->name, $method->kind, $method->split])->all())->toBe([
            ['Cash', PaymentMethodKind::Cash, true],
            ['Card', PaymentMethodKind::Card, true],
            ['E-wallet', PaymentMethodKind::Qr, true],
            ['Pay later', PaymentMethodKind::Tab, false],
        ])
            ->and($methods->every('active'))->toBeTrue()
            ->and($payLater->tab_limit)->toBe('1000.00')
            ->and($payLater->lead_only)->toBeTrue();
    });
});

test('does not duplicate records when seeded twice', function () {
    $this->seed();

    $this->seed();

    expect(User::count())->toBe(5)
        ->and(Branch::count())->toBe(4)
        ->and(StockItem::count())->toBe(32)
        ->and(MenuItem::count())->toBe(21)
        ->and(Addon::count())->toBe(4)
        ->and(PaymentMethod::count())->toBe(8);
    $this->assertDatabaseCount('categories', 10);
    $this->assertDatabaseCount('branch_menu_items', 42);
    $this->assertDatabaseCount('role_permissions', 48);
});
