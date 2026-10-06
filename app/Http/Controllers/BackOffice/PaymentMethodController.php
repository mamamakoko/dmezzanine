<?php

namespace App\Http\Controllers\BackOffice;

use App\Enums\PaymentMethodKind;
use App\Models\Branch;
use App\Models\PaymentMethod;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Till settings: the payment methods this branch's till offers. Every change goes in the branch's log,
 * and at least one method must stay on.
 */
class PaymentMethodController extends BackOfficeController
{
    public function store(Request $request): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manage', $branch);

        $method = $branch->paymentMethods()->create($this->validated($request, $branch) + ['active' => true]);
        $this->log($method, "added {$method->name}");

        return back();
    }

    public function update(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizeStaff('update', $paymentMethod);

        $oldName = $paymentMethod->name;
        $paymentMethod->update($this->validated($request, $paymentMethod->branch, $paymentMethod));
        $this->log($paymentMethod, $oldName !== $paymentMethod->name ? "renamed {$oldName} to {$paymentMethod->name}" : "edited {$paymentMethod->name}");

        return back();
    }

    /**
     * Switch the method on or off at the till.
     */
    public function toggle(Request $request, PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizeStaff('update', $paymentMethod);
        $active = $request->validate(['active' => ['required', 'boolean']])['active'];

        DB::transaction(function () use ($paymentMethod, $active) {
            if (! $active) {
                $this->ensureAnotherStaysOn($paymentMethod, 'Keep at least one payment method on.');
            }

            $paymentMethod->update(['active' => $active]);
            $this->log($paymentMethod, "switched {$paymentMethod->name} ".($active ? 'on' : 'off'));
        });

        return back();
    }

    /**
     * Remove the method. Past sales keep the method's name.
     */
    public function destroy(PaymentMethod $paymentMethod): RedirectResponse
    {
        $this->authorizeStaff('delete', $paymentMethod);

        DB::transaction(function () use ($paymentMethod) {
            $this->ensureAnotherStaysOn($paymentMethod, 'Keep at least one payment method on. Switch another one on first.');

            $this->log($paymentMethod, "removed {$paymentMethod->name}");
            $paymentMethod->delete();
        });

        return back();
    }

    /**
     * Run inside a transaction: locks the branch row so two tills can't switch off the last methods at once.
     */
    private function ensureAnotherStaysOn(PaymentMethod $paymentMethod, string $message): void
    {
        Branch::whereKey($paymentMethod->branch_id)->lockForUpdate()->first();
        $othersOn = $paymentMethod->branch->paymentMethods()->where('active', true)->whereKeyNot($paymentMethod->id)->exists();

        if (! $othersOn) {
            throw ValidationException::withMessages(['payment_method' => $message]);
        }
    }

    /**
     * Only the fields for the method's kind are kept; a tab can never be split.
     *
     * @return array<string, mixed>
     */
    private function validated(Request $request, Branch $branch, ?PaymentMethod $paymentMethod = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('payment_methods')->where('branch_id', $branch->id)->ignore($paymentMethod)],
            'kind' => ['required', Rule::enum(PaymentMethodKind::class)],
            'note' => ['nullable', 'string', 'max:300'],
            'split' => ['boolean'],
            'terminal' => ['nullable', 'string', 'max:80'],
            'wallets' => ['nullable', 'string', 'max:80'],
            'tab_limit' => ['nullable', 'numeric', 'min:0', 'max:1000000'],
            'lead_only' => ['boolean'],
        ], [
            'name.required' => 'Give the method a name.',
            'name.unique' => 'This branch already has a method with that name.',
        ]);

        $kind = PaymentMethodKind::from($data['kind']);

        return [
            'name' => trim($data['name']),
            'kind' => $kind,
            'note' => $data['note'] ?? null,
            'split' => $kind !== PaymentMethodKind::Tab && ($data['split'] ?? false),
            'terminal' => $kind === PaymentMethodKind::Card ? ($data['terminal'] ?? null) : null,
            'wallets' => $kind === PaymentMethodKind::Qr ? ($data['wallets'] ?? null) : null,
            'tab_limit' => $kind === PaymentMethodKind::Tab && ($data['tab_limit'] ?? 0) > 0 ? $data['tab_limit'] : null,
            'lead_only' => $kind === PaymentMethodKind::Tab && ($data['lead_only'] ?? false),
        ];
    }

    private function log(PaymentMethod $paymentMethod, string $description): void
    {
        $paymentMethod->branch->paymentMethodLogs()->create([
            'payment_method_id' => $paymentMethod->id,
            'user_id' => $this->staff()->id,
            'description' => $description,
        ]);
    }
}
