<?php

use App\Enums\PermissionArea;
use App\Http\Controllers\BackOffice\AddonController;
use App\Http\Controllers\BackOffice\BranchMenuController;
use App\Http\Controllers\BackOffice\CategoryController;
use App\Http\Controllers\BackOffice\MenuItemController;
use App\Http\Controllers\BackOffice\PaymentMethodController;
use App\Http\Controllers\BackOffice\RefundController;
use App\Http\Controllers\BranchMenuOrderController;
use App\Http\Controllers\PosOrderController;
use App\Http\Controllers\PosUnlockController;
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
        });
    });

    Route::middleware('can:'.PermissionArea::Menu->value)->group(function () {
        Route::get('branch-menu', [TillController::class, 'branchMenu'])->name('menu');
        Route::post('branch-menu/orders', [BranchMenuOrderController::class, 'store'])->name('menu.orders.store');
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
     * One entry point per remaining workspace, each behind its area's gate. The
     * workspaces are built in later stages; until then each shows a placeholder.
     */
    $workspaces = [
        'marketing' => PermissionArea::Marketing,
        'inventory' => PermissionArea::Inventory,
        'owner' => PermissionArea::Owner,
        'sales' => PermissionArea::Sales,
    ];

    foreach ($workspaces as $path => $area) {
        Route::get($path, function () use ($area) {
            return Inertia::render('workspace-pending', ['area' => $area->value]);
        })->middleware("can:{$area->value}")->name($area->value);
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
