<?php

namespace App\Http\Requests;

use App\Enums\BranchKind;
use App\Models\Role;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A client pin on the marketing map. Any marketing user can add and edit clients.
 */
class SaveClientRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'client_type_id' => ['required', 'integer', 'exists:client_types,id'],
            'contact' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:200'],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')->where('kind', BranchKind::Branch->value)],
            'officer_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where(
                fn ($query) => $query->whereIn('role_id', fn ($roles) => $roles->select('id')->from('roles')->where('name', Role::MARKETING)),
            )],
            'last_order_on' => ['nullable', 'date_format:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:2000'],
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
            'name.required' => 'Give the client a name.',
            'lat.required' => 'Place a pin on the map first.',
            'lng.required' => 'Place a pin on the map first.',
            'officer_id.exists' => 'Officers are users with the Marketing role.',
        ];
    }
}
