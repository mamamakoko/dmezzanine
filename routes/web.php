<?php

use App\Enums\PermissionArea;
use App\Http\Controllers\BranchMenuOrderController;
use App\Http\Controllers\PosOrderController;
use App\Http\Controllers\PosUnlockController;
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

        });
    });

    Route::middleware('can:'.PermissionArea::Menu->value)->group(function () {
        Route::get('branch-menu', [TillController::class, 'branchMenu'])->name('menu');
        Route::post('branch-menu/orders', [BranchMenuOrderController::class, 'store'])->name('menu.orders.store');
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
        'stock-count' => PermissionArea::Count,
        'stock-report' => PermissionArea::Report,
    ];

    foreach ($workspaces as $path => $area) {
        Route::get($path, function () use ($area) {
            return Inertia::render('workspace-pending', ['area' => $area->value]);
        })->middleware("can:{$area->value}")->name($area->value);
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
