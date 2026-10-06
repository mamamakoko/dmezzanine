<?php

namespace App\Http\Requests;

use App\Enums\BranchKind;
use App\Enums\MarketingService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A marketing order for a branch. No prices are accepted; the till prices it when the branch accepts.
 */
class SendMarketingOrderRequest extends FormRequest
{
    /**
     * Access is checked by the route's "can:marketing" middleware.
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
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('kind', BranchKind::Branch->value)],
            'service' => ['required', Rule::enum(MarketingService::class)],
            'customer' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:200'],
            'wanted_on' => ['required', 'date_format:Y-m-d'],
            'wanted_at' => ['nullable', 'date_format:H:i'],
            'note' => ['nullable', 'string', 'max:200'],
            'lines' => ['required', 'array', 'min:1', 'max:60'],
            'lines.*.menu_item_id' => ['required', 'integer'],
            'lines.*.qty' => ['required', 'integer', 'between:1,999'],
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
            'customer.required' => 'Add the customer name.',
            'lines.required' => 'Add at least one item.',
            'wanted_on.required' => 'Pick the date it is needed.',
        ];
    }
}
