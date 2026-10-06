<?php

namespace App\Http\Controllers;

use App\Enums\OrderSource;
use App\Enums\OrderStatus;
use App\Http\Requests\SettleOrderRequest;
use App\Http\Requests\StoreSaleRequest;
use App\Models\Order;
use App\Services\TillCheckout;
use App\Services\TillSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Orders at the unlocked POS till: ring up and pay, settle unpaid orders, and move orders along the queue.
 */
class PosOrderController extends Controller
{
    public function __construct(private TillSession $till, private TillCheckout $checkout) {}

    /**
     * Take an order and its payment, then show the receipt.
     */
    public function store(StoreSaleRequest $request): RedirectResponse
    {
        $order = $this->checkout->placeOrder($request->user()->branch, $this->till->staff(), $request->validated(), OrderSource::Till);

        return to_route('pos')->with('receipt_order_id', $order->id);
    }

    /**
     * Take payment for an unpaid order or a tab, then show the receipt.
     */
    public function settle(SettleOrderRequest $request, Order $order): RedirectResponse
    {
        Gate::authorize('update', $order);

        $this->checkout->settle($order, $this->till->staff(), $request->validated());

        return to_route('pos')->with('receipt_order_id', $order->id);
    }

    /**
     * Move an order to the next step on the queue board: Preparing → Ready → Served.
     */
    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        Gate::authorize('update', $order);

        $status = OrderStatus::from($request->validate(['status' => ['required', Rule::enum(OrderStatus::class)]])['status']);

        if ($order->status->next() !== $status) {
            throw ValidationException::withMessages(['status' => "Order #{$order->no} is already {$order->status->value}."]);
        }

        $order->update(['status' => $status]);

        return to_route('pos');
    }

    /**
     * Lock the till so the next person has to enter their PIN.
     */
    public function lock(): RedirectResponse
    {
        $this->till->lock();

        return to_route('pos');
    }
}
