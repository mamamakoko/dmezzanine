<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Concerns\HandlesTransfers;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Transfer;
use App\Models\User;
use App\Services\Transfers;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Transfers in Inventory. The warehouse or commissary asked for stock approves, rejects and issues; the
 * location that asked receives, cancels and raises its own requests.
 */
class TransferController extends Controller
{
    use HandlesTransfers;

    /**
     * A warehouse or the commissary asks another location for stock.
     */
    public function store(Request $request, Branch $branch, Transfers $transfers): RedirectResponse
    {
        Gate::authorize('manageStock', $branch);

        $data = $this->validatedRequisition($request);
        $transfers->requisition(Branch::findOrFail($data['from_branch_id']), $branch, $this->requestedLines($data), $request->user());

        return back();
    }

    public function approve(Transfer $transfer, Transfers $transfers): RedirectResponse
    {
        Gate::authorize('send', $transfer);

        $transfers->approve($transfer, $this->actor());

        return back();
    }

    public function reject(Transfer $transfer, Transfers $transfers): RedirectResponse
    {
        Gate::authorize('send', $transfer);

        $transfers->reject($transfer, $this->actor());

        return back();
    }

    /**
     * Issue and send: the stock leaves this location.
     */
    public function issue(Transfer $transfer, Transfers $transfers): RedirectResponse
    {
        Gate::authorize('send', $transfer);

        $transfers->issue($transfer, $this->actor());

        return back();
    }

    protected function actor(): User
    {
        return request()->user();
    }

    protected function authorizeActor(string $ability, mixed $arguments): void
    {
        Gate::authorize($ability, $arguments);
    }
}
