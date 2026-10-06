<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hides email/password sign-in and password reset unless auth.password_login is on (local development).
 */
class EnsurePasswordLoginIsEnabled
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless(config('auth.password_login'), 404);

        return $next($request);
    }
}
