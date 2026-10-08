<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Suppliers, shared by every location. Removing one leaves its items without a supplier.
 */
class SupplierController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        Supplier::create($this->validated($request));

        return back();
    }

    public function update(Request $request, Supplier $supplier): RedirectResponse
    {
        $supplier->update($this->validated($request));

        return back();
    }

    public function destroy(Supplier $supplier): RedirectResponse
    {
        $supplier->delete();

        return back();
    }

    /**
     * @return array{name: string, contact: ?string, phone: ?string, supplies: ?string}
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'contact' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'supplies' => ['nullable', 'string', 'max:160'],
        ]);
    }
}
