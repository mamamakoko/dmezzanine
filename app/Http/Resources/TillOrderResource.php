<?php

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderLine;
use App\Models\OrderPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An order as the till shows it on the queue board and the receipt. Needs lines.addons, payments and
 * cashier loaded. The Branch Menu gets it without any amounts.
 *
 * @mixin Order
 */
class TillOrderResource extends JsonResource
{
    private bool $withPrices = true;

    /**
     * Leave out every amount, for the order-only Branch Menu.
     */
    public function withoutPrices(): static
    {
        $this->withPrices = false;

        return $this;
    }

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'no' => $this->no,
            'ticket' => $this->ticket,
            'service' => $this->service->label(),
            'status' => $this->status,
            'source' => $this->source,
            'unpaid' => $this->unpaid,
            'tab_name' => $this->tab_name,
            'note' => $this->note,
            'senior' => $this->senior,
            'cashier' => $this->cashier?->name,
            'created_at' => $this->created_at->toIso8601String(),
            'marketing' => $this->whenLoaded('marketingOrder', fn () => $this->marketingOrder ? [
                'no' => $this->marketingOrder->number(),
                'customer' => $this->marketingOrder->customer,
                'phone' => $this->marketingOrder->phone,
                'address' => $this->marketingOrder->address,
                'wanted' => $this->marketingOrder->wantedLabel(),
                'service' => $this->marketingOrder->service->label(),
            ] : null),
            'lines' => $this->lines->map(fn (OrderLine $line) => [
                'qty' => $line->qty,
                'name' => $line->name,
                'mods' => $line->modsLabel(),
                ...($this->withPrices ? ['line_total' => (float) $line->line_total] : []),
            ])->all(),
            $this->mergeWhen($this->withPrices, fn () => [
                'gross' => (float) $this->gross,
                'vat_exempt' => (float) $this->vat_exempt,
                'discount' => (float) $this->discount,
                'vat' => (float) $this->vat,
                'total' => (float) $this->total,
                'payments' => $this->payments->map(fn (OrderPayment $payment) => [
                    'method' => $payment->method_name,
                    'kind' => $payment->kind,
                    'amount' => (float) $payment->amount,
                    'tendered' => $payment->tendered === null ? null : (float) $payment->tendered,
                    'change' => (float) $payment->change,
                ])->all(),
            ]),
        ];
    }
}
