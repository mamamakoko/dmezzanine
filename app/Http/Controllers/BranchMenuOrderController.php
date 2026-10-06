<?php

namespace App\Http\Controllers;

use App\Enums\OrderSource;
use App\Http\Requests\StoreOrderRequest;
use App\Services\TillCheckout;
use Illuminate\Http\RedirectResponse;

/**
 * Orders sent from the order-only Branch Menu. They join the queue unpaid, and the cashier takes payment.
 */
class BranchMenuOrderController extends Controller
{
    /**
     * Send the order and its ticket to the cashier.
     */
    public function store(StoreOrderRequest $request, TillCheckout $checkout): RedirectResponse
    {
        $branch = $request->user()->branch;

        abort_if($branch === null, 403, 'Your account has no branch to send orders to.');

        $order = $checkout->placeOrder($branch, $request->user(), $request->validated(), OrderSource::BranchMenu);

        return to_route('menu')->with('receipt_order_id', $order->id);
    }
}
