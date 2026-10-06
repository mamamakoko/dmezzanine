<?php

namespace App\Http\Middleware;

use App\Services\TillSession;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Till actions need a staff member to have unlocked the till with their PIN.
 */
class EnsureTillIsUnlocked
{
    public function __construct(private TillSession $till) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->till->staff() === null) {
            return redirect()->route('pos')->withErrors(['pin' => 'The till is locked. Enter your PIN to continue.']);
        }

        return $next($request);
    }
}
