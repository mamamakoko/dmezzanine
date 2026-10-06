<?php

namespace App\Http\Controllers\BackOffice;

use App\Models\Addon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The add-on list is shared by every branch and only the Owner edits it: names, prices, ingredients and
 * which items offer each one. A branch switches an add-on off for itself when it runs out.
 */
class AddonController extends BackOfficeController
{
    public function store(Request $request): RedirectResponse
    {
        $this->authorizeStaff('create', Addon::class);

        $this->save(new Addon, $request);

        return back();
    }

    public function update(Request $request, Addon $addon): RedirectResponse
    {
        $this->authorizeStaff('update', $addon);

        $this->save($addon, $request);

        return back();
    }

    /**
     * Remove the add-on from every branch. Past orders keep its name and price.
     */
    public function destroy(Addon $addon): RedirectResponse
    {
        $this->authorizeStaff('delete', $addon);

        $addon->delete();

        return back();
    }

    /**
     * Switch the add-on on or off at this till's branch.
     */
    public function availability(Request $request, Addon $addon): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manage', $branch);

        if ($request->validate(['on' => ['required', 'boolean']])['on']) {
            $branch->disabledAddons()->detach($addon);
        } else {
            $branch->disabledAddons()->syncWithoutDetaching([$addon->id]);
        }

        return back();
    }

    private function save(Addon $addon, Request $request): void
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('addons')->ignore($addon)],
            'price' => ['required', 'numeric', 'min:0', 'max:10000'],
            'parts' => ['array'],
            'parts.*.stock_item_id' => ['required', 'integer', 'distinct', 'exists:stock_items,id'],
            'parts.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'menu_item_ids' => ['array'],
            'menu_item_ids.*' => ['integer', 'distinct', 'exists:menu_items,id'],
        ], [
            'name.required' => 'Give the add-on a name.',
            'name.unique' => 'There is already an add-on with that name.',
            'parts.*.qty.gt' => 'Each ingredient needs an amount per serving.',
        ]);

        $addon->fill(['name' => trim($data['name']), 'price' => $data['price']])->save();
        $addon->parts()->sync(collect($data['parts'] ?? [])->mapWithKeys(fn (array $part) => [$part['stock_item_id'] => ['qty' => $part['qty']]])->all());
        $addon->menuItems()->sync($data['menu_item_ids'] ?? []);
    }
}
