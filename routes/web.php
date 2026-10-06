<?php

use App\Enums\PermissionArea;
use App\Http\Controllers\PosUnlockController;
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
     * One entry point per workspace, each behind its area's gate. The workspaces
     * are built in later stages; until then each shows a placeholder.
     */
    $workspaces = [
        'pos' => PermissionArea::Pos,
        'branch-menu' => PermissionArea::Menu,
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

    Route::post('pos/unlock', PosUnlockController::class)
        ->middleware(['can:'.PermissionArea::Pos->value, 'throttle:pos-unlock'])
        ->name('pos.unlock');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
