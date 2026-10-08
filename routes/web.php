<?php

use App\Enums\PermissionArea;
use App\Http\Controllers\BackOffice\AddonController;
use App\Http\Controllers\BackOffice\BranchMenuController;
use App\Http\Controllers\BackOffice\CategoryController;
use App\Http\Controllers\BackOffice\MenuItemController;
use App\Http\Controllers\BackOffice\PaymentMethodController;
use App\Http\Controllers\BackOffice\RefundController;
use App\Http\Controllers\BackOffice\StockInController;
use App\Http\Controllers\BranchMenuOrderController;
use App\Http\Controllers\ClientMapController;
use App\Http\Controllers\Inventory\ProductController;
use App\Http\Controllers\Inventory\ShoppingListController;
use App\Http\Controllers\Inventory\SupplierController;
use App\Http\Controllers\Inventory\TransferController;
use App\Http\Controllers\Inventory\WarehouseItemController;
use App\Http\Controllers\InventoryController;
use App\Http\Controllers\MarketingController;
use App\Http\Controllers\MarketingInboxController;
use App\Http\Controllers\Owner\BranchController as OwnerBranchController;
use App\Http\Controllers\Owner\UserController;
use App\Http\Controllers\OwnerController;
use App\Http\Controllers\PosOrderController;
use App\Http\Controllers\PosUnlockController;
use App\Http\Controllers\SalesController;
use App\Http\Controllers\StockCountController;
use App\Http\Controllers\StockReportController;
use App\Http\Controllers\TillController;
use App\Http\Middleware\EnsureTillIsUnlocked;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth'])->group(function () {
    Route::get('/', function () {
        return Inertia::render('landing');
    })->name('home');

    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    /*
     * The till. POS takes payment once a staff member unlocks it with their PIN; the
     * Branch Menu is the same till in order-only mode and sends orders to the cashier.
     */
    Route::middleware('can:'.PermissionArea::Pos->value)->group(function () {
        Route::get('pos', [TillController::class, 'pos'])->name('pos');

        Route::post('pos/unlock', PosUnlockController::class)
            ->middleware('throttle:pos-unlock')
            ->name('pos.unlock');

        Route::middleware(EnsureTillIsUnlocked::class)->prefix('pos')->name('pos.')->group(function () {
            Route::post('lock', [PosOrderController::class, 'lock'])->name('lock');
            Route::post('orders', [PosOrderController::class, 'store'])->name('orders.store');
            Route::post('orders/{order}/settle', [PosOrderController::class, 'settle'])->name('orders.settle');
            Route::patch('orders/{order}/status', [PosOrderController::class, 'updateStatus'])->name('orders.status');
            Route::post('inbox/{marketingOrder}/accept', [MarketingInboxController::class, 'accept'])->name('inbox.accept');
            Route::post('inbox/{marketingOrder}/decline', [MarketingInboxController::class, 'decline'])->name('inbox.decline');

            /*
             * The back office inside the till. Policies check the staff member who unlocked it.
             */
            Route::post('orders/{order}/refunds', [RefundController::class, 'store'])->middleware('throttle:pos-unlock')->name('orders.refunds.store');

            Route::post('categories', [CategoryController::class, 'store'])->name('categories.store');
            Route::patch('categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
            Route::delete('categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

            Route::post('menu', [BranchMenuController::class, 'store'])->name('menu.store');
            Route::patch('menu/{branchMenuItem}', [BranchMenuController::class, 'update'])->name('menu.update');
            Route::delete('menu/{branchMenuItem}', [BranchMenuController::class, 'destroy'])->name('menu.destroy');

            Route::post('menu-items', [MenuItemController::class, 'store'])->name('menu-items.store');
            Route::put('menu-items/{menuItem}', [MenuItemController::class, 'update'])->name('menu-items.update');
            Route::post('menu-items/{menuItem}/photo', [MenuItemController::class, 'storePhoto'])->name('menu-items.photo.store');
            Route::delete('menu-items/{menuItem}/photo', [MenuItemController::class, 'destroyPhoto'])->name('menu-items.photo.destroy');

            Route::post('addons', [AddonController::class, 'store'])->name('addons.store');
            Route::put('addons/{addon}', [AddonController::class, 'update'])->name('addons.update');
            Route::delete('addons/{addon}', [AddonController::class, 'destroy'])->name('addons.destroy');
            Route::put('addons/{addon}/availability', [AddonController::class, 'availability'])->name('addons.availability');

            Route::post('payment-methods', [PaymentMethodController::class, 'store'])->name('payment-methods.store');
            Route::put('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update');
            Route::patch('payment-methods/{paymentMethod}/toggle', [PaymentMethodController::class, 'toggle'])->name('payment-methods.toggle');
            Route::delete('payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->name('payment-methods.destroy');

            Route::post('deliveries', [StockInController::class, 'receiveDelivery'])->name('deliveries.store');
            Route::post('requisitions', [StockInController::class, 'requisition'])->name('requisitions.store');
            Route::scopeBindings()->prefix('transfers/{transfer}')->name('transfers.')->group(function () {
                Route::post('receive', [StockInController::class, 'receive'])->name('receive');
                Route::post('lines/{line}/receive', [StockInController::class, 'receiveLine'])->name('lines.receive');
                Route::put('lines/{line}/issue', [StockInController::class, 'flag'])->name('lines.flag');
                Route::post('cancel', [StockInController::class, 'cancel'])->name('cancel');
            });
        });
    });

    Route::middleware('can:'.PermissionArea::Menu->value)->group(function () {
        Route::get('branch-menu', [TillController::class, 'branchMenu'])->name('menu');
        Route::post('branch-menu/orders', [BranchMenuOrderController::class, 'store'])->name('menu.orders.store');
    });

    /*
     * Marketing: orders taken off-site for a branch (no prices anywhere), and the client map. Anyone in
     * Marketing records clients; the legend, areas and branch pins are the Owner's.
     */
    Route::middleware('can:'.PermissionArea::Marketing->value)->prefix('marketing')->name('marketing')->group(function () {
        Route::get('/', [MarketingController::class, 'show']);
        Route::post('orders', [MarketingController::class, 'store'])->name('.orders.store');

        Route::get('clients', [ClientMapController::class, 'show'])->name('.clients');
        Route::post('clients', [ClientMapController::class, 'storeClient'])->name('.clients.store');
        Route::put('clients/{client}', [ClientMapController::class, 'updateClient'])->name('.clients.update');
        Route::delete('clients/{client}', [ClientMapController::class, 'destroyClient'])->name('.clients.destroy');
        Route::put('client-types', [ClientMapController::class, 'saveTypes'])->name('.client-types.save');
        Route::post('areas', [ClientMapController::class, 'storeArea'])->name('.areas.store');
        Route::put('areas/{clientArea}', [ClientMapController::class, 'updateArea'])->name('.areas.update');
        Route::delete('areas/{clientArea}', [ClientMapController::class, 'destroyArea'])->name('.areas.destroy');
        Route::put('branches/{branch}/location', [ClientMapController::class, 'moveBranch'])->name('.branches.location');
    });

    /*
     * Daily stock count and the manager's stock report. Approving a day posts its endings as the
     * branch's on hand, which the till shows.
     */
    Route::middleware('can:'.PermissionArea::Count->value)->group(function () {
        Route::get('stock-count', [StockCountController::class, 'show'])->name('count');
        Route::put('stock-count/{branch}/lines/{stockItem}', [StockCountController::class, 'updateLine'])->name('count.lines.update');
        Route::post('stock-count/{branch}/submit', [StockCountController::class, 'submit'])->name('count.submit');
    });

    Route::middleware('can:'.PermissionArea::Report->value)->prefix('stock-report')->group(function () {
        Route::get('/', [StockReportController::class, 'show'])->name('report');
        Route::patch('lines/{stockCountLine}', [StockReportController::class, 'updateLine'])->name('report.lines.update');
        Route::post('sheets/{stockCount}/approve', [StockReportController::class, 'approve'])->name('report.sheets.approve');
        Route::post('sheets/{stockCount}/return', [StockReportController::class, 'returnForRecount'])->name('report.sheets.return');
        Route::post('sheets/{stockCount}/reopen', [StockReportController::class, 'reopen'])->name('report.sheets.reopen');
        Route::put('{branch}/months/{month}', [StockReportController::class, 'signMonth'])->where('month', '\d{4}-\d{2}')->name('report.months.sign');
    });

    /*
     * Inventory: the warehouse and commissary, transfers between locations (branch requisitions
     * included), the shopping list and suppliers. Each location's own staff or the Owner change its stock.
     */
    Route::middleware('can:'.PermissionArea::Inventory->value)->prefix('inventory')->name('inventory')->group(function () {
        Route::get('/', [InventoryController::class, 'show']);

        Route::post('locations/{branch}/items', [WarehouseItemController::class, 'store'])->name('.items.store');
        Route::put('locations/{branch}/categories', [WarehouseItemController::class, 'renameCategory'])->name('.categories.rename');
        Route::put('items/{warehouseStock}', [WarehouseItemController::class, 'update'])->name('.items.update');
        Route::patch('items/{warehouseStock}/on-hand', [WarehouseItemController::class, 'adjust'])->name('.items.adjust');
        Route::delete('items/{warehouseStock}', [WarehouseItemController::class, 'destroy'])->name('.items.destroy');

        Route::post('locations/{branch}/requisitions', [TransferController::class, 'store'])->name('.requisitions.store');
        Route::scopeBindings()->prefix('transfers/{transfer}')->name('.transfers.')->group(function () {
            Route::post('approve', [TransferController::class, 'approve'])->name('approve');
            Route::post('reject', [TransferController::class, 'reject'])->name('reject');
            Route::post('issue', [TransferController::class, 'issue'])->name('issue');
            Route::post('cancel', [TransferController::class, 'cancel'])->name('cancel');
            Route::post('receive', [TransferController::class, 'receive'])->name('receive');
            Route::post('lines/{line}/receive', [TransferController::class, 'receiveLine'])->name('lines.receive');
            Route::put('lines/{line}/issue', [TransferController::class, 'flag'])->name('lines.flag');
        });

        Route::post('products', [ProductController::class, 'store'])->name('.products.store');
        Route::put('products/{product}', [ProductController::class, 'update'])->name('.products.update');
        Route::delete('products/{product}', [ProductController::class, 'destroy'])->name('.products.destroy');
        Route::put('products/{product}/recipe', [ProductController::class, 'recipe'])->name('.products.recipe');
        Route::post('products/{product}/batches', [ProductController::class, 'logBatch'])->name('.batches.store');
        Route::patch('batches/{productionBatch}', [ProductController::class, 'advanceBatch'])->name('.batches.advance');

        Route::post('shopping-list', [ShoppingListController::class, 'store'])->name('.shopping.store');
        Route::patch('shopping-list/{shoppingListLine}', [ShoppingListController::class, 'update'])->name('.shopping.update');
        Route::delete('shopping-list', [ShoppingListController::class, 'destroy'])->name('.shopping.destroy');

        Route::post('suppliers', [SupplierController::class, 'store'])->name('.suppliers.store');
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->name('.suppliers.update');
        Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->name('.suppliers.destroy');
    });

    /*
     * Sales reporting: the Owner across café branches, everyone else for their own branch.
     */
    Route::get('sales', [SalesController::class, 'show'])->middleware('can:'.PermissionArea::Sales->value)->name('sales');

    /*
     * The Owner console: users, page access, locations and the activity log.
     */
    Route::middleware('can:'.PermissionArea::Owner->value)->prefix('owner')->name('owner')->group(function () {
        Route::get('/', [OwnerController::class, 'show']);

        Route::post('users', [UserController::class, 'store'])->name('.users.store');
        Route::put('users/{user}', [UserController::class, 'update'])->name('.users.update');
        Route::patch('users/{user}/access', [UserController::class, 'toggle'])->name('.users.access');
        Route::post('users/{user}/credentials', [UserController::class, 'credentials'])->name('.users.credentials');
        Route::put('users/{user}/pages/{area}', [UserController::class, 'pages'])->name('.users.pages');

        Route::post('locations', [OwnerBranchController::class, 'store'])->name('.locations.store');
        Route::put('locations/{branch}', [OwnerBranchController::class, 'update'])->name('.locations.update');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
