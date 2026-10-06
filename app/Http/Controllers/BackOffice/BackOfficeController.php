<?php

namespace App\Http\Controllers\BackOffice;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\User;
use App\Services\TillSession;
use Illuminate\Support\Facades\Gate;

/**
 * Back-office actions inside the till. They run as the staff member who unlocked the till with their PIN,
 * so policies check that person, at the signed-in account's branch.
 */
abstract class BackOfficeController extends Controller
{
    private ?User $staff = null;

    public function __construct(private TillSession $till) {}

    protected function staff(): User
    {
        return $this->staff ??= $this->till->staff();
    }

    protected function branch(): Branch
    {
        return request()->user()->branch;
    }

    /**
     * Authorize the till's staff member for an ability.
     *
     * @param  mixed  $arguments
     */
    protected function authorizeStaff(string $ability, $arguments = []): void
    {
        Gate::forUser($this->staff())->authorize($ability, $arguments);
    }
}
