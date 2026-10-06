<?php

namespace App\Providers;

use App\Enums\PermissionArea;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach (PermissionArea::cases() as $area) {
            Gate::define($area->value, fn (User $user) => $user->canAccess($area));
        }

        RateLimiter::for('pos-unlock', function (Request $request) {
            return Limit::perMinute(5)->by($request->user()?->id.'|'.$request->ip());
        });
    }
}
