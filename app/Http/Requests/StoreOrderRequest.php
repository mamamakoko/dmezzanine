<?php

namespace App\Http\Requests;

use App\Enums\DrinkSize;
use App\Enums\Milk;
use App\Enums\OrderService;
use App\Services\TillCheckout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * An order sent to the cashier from the Branch Menu: the items and the ticket, with no payment.
 * Prices are looked up on the server, so none are accepted here.
 */
class StoreOrderRequest extends FormRequest
{
    /**
     * Access is checked by the route's "can" middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'service' => ['required', Rule::enum(OrderService::class)],
            'ticket' => ['required', 'integer', 'between:1,'.TillCheckout::TICKETS],
            'note' => ['nullable', 'string', 'max:200'],
            'lines' => ['required', 'array', 'min:1', 'max:50'],
            'lines.*.menu_item_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'between:1,99'],
            'lines.*.size' => ['nullable', Rule::enum(DrinkSize::class)],
            'lines.*.milk' => ['nullable', Rule::enum(Milk::class)],
            'lines.*.addon_ids' => ['nullable', 'array'],
            'lines.*.addon_ids.*' => ['integer', 'distinct'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lines.required' => 'Add an item first.',
            'ticket.required' => 'Pick a ticket number.',
            'ticket.between' => 'Pick a ticket from 01 to '.TillCheckout::TICKETS.'.',
        ];
    }
}
