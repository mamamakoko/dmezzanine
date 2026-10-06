<?php

namespace App\Http\Controllers;

use App\Models\MarketingOrder;
use App\Services\MarketingOrders;
use App\Services\TillSession;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * The till's inbox of orders from marketing: accept one onto the queue, or decline it.
 */
class MarketingInboxController extends Controller
{
    public function __construct(private TillSession $till, private MarketingOrders $orders) {}

    public function accept(MarketingOrder $marketingOrder): RedirectResponse
    {
        Gate::authorize('respond', $marketingOrder);

        $marketingOrder = $this->orders->accept($marketingOrder, $this->till->staff());

        return back()->with('status', sprintf('%s accepted · ticket %02d', $marketingOrder->number(), $marketingOrder->order->ticket));
    }

    public function decline(Request $request, MarketingOrder $marketingOrder): RedirectResponse
    {
        Gate::authorize('respond', $marketingOrder);

        $reply = $request->validate(['reply' => ['nullable', 'string', 'max:200']])['reply'] ?? null;
        $this->orders->decline($marketingOrder, $this->till->staff(), $reply);

        return back();
    }
}
