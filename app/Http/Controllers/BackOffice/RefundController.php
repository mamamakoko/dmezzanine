<?php

namespace App\Http\Controllers\BackOffice;

use App\Models\Order;
use App\Services\RefundService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Refunds from the Sales tab: per line and quantity, approved with a manager's PIN.
 */
class RefundController extends BackOfficeController
{
    public function store(Request $request, Order $order, RefundService $refunds): RedirectResponse
    {
        $this->authorizeStaff('refund', $order);

        $data = $request->validate([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.order_line_id' => ['required', 'integer', 'distinct'],
            'lines.*.qty' => ['required', 'integer', 'min:1'],
            'reason' => ['required', Rule::in(RefundService::REASONS)],
            'method' => ['required', Rule::in(array_keys(RefundService::METHODS))],
            'pin' => ['required', 'digits:4'],
        ], [
            'lines.required' => 'Pick at least one item to refund.',
            'pin.required' => 'A manager PIN is needed to approve a refund.',
            'pin.digits' => 'A manager PIN is needed to approve a refund.',
        ]);

        $refund = $refunds->refund($order, $this->staff(), $data);

        return back()->with('status', "Refund #{$refund->no} recorded against #{$order->no}.");
    }
}
