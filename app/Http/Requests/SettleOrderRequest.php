<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Payment for an order that was sent unpaid or put on a tab.
 */
class SettleOrderRequest extends FormRequest
{
    /**
     * Branch access is checked by OrderPolicy in the controller.
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
            'senior' => ['boolean'],
            ...self::paymentRules(),
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return self::paymentMessages();
    }

    /**
     * The shape of a payment: one method (with cash tendered or a tab name), or a split across several.
     * TillCheckout checks the amounts against the branch's methods.
     *
     * @return array<string, array<mixed>>
     */
    public static function paymentRules(): array
    {
        return [
            'split' => ['boolean'],
            'payment_method_id' => ['exclude_if:split,true', 'required', 'integer'],
            'tendered' => ['exclude_if:split,true', 'nullable', 'numeric', 'min:0', 'max:1000000'],
            'tab_name' => ['exclude_if:split,true', 'nullable', 'string', 'max:80'],
            'parts' => ['exclude_unless:split,true', 'required', 'array', 'min:1', 'max:6'],
            'parts.*.payment_method_id' => ['exclude_unless:split,true', 'required', 'integer'],
            'parts.*.amount' => ['exclude_unless:split,true', 'required', 'numeric', 'gt:0', 'max:1000000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function paymentMessages(): array
    {
        return [
            'payment_method_id.required' => 'Pick a payment method.',
            'parts.required' => 'Add at least one payment.',
            'parts.*.amount.required' => 'Enter an amount for each payment in the split.',
            'parts.*.amount.gt' => 'Enter an amount for each payment in the split.',
        ];
    }
}
