<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A sale at the till: the order, the senior/PWD discount and its payment.
 */
class StoreSaleRequest extends StoreOrderRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'senior' => ['boolean'],
            ...SettleOrderRequest::paymentRules(),
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
            ...parent::messages(),
            ...SettleOrderRequest::paymentMessages(),
        ];
    }
}
