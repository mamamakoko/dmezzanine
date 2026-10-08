<?php

namespace App\Http\Controllers\BackOffice;

use App\Events\MenuAvailabilityChanged;
use App\Models\BranchMenuItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Which shared menu items this branch sells, in which of its categories, and whether each is on the board.
 */
class BranchMenuController extends BackOfficeController
{
    /**
     * Put an existing menu item on this branch's menu.
     */
    public function store(Request $request): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manage', $branch);

        $data = $request->validate([
            'menu_item_id' => ['required', 'integer', 'exists:menu_items,id', Rule::unique('branch_menu_items')->where('branch_id', $branch->id)],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('branch_id', $branch->id)],
        ], [
            'menu_item_id.unique' => 'That item is already on this menu.',
            'category_id.required' => 'Pick a category.',
        ]);

        $branch->menuEntries()->create($data + ['available' => true, 'sort' => (int) $branch->menuEntries()->max('sort') + 1]);
        MenuAvailabilityChanged::dispatch($branch->id);

        return back();
    }

    /**
     * Change the item's category here, or take it on or off the board.
     */
    public function update(Request $request, BranchMenuItem $branchMenuItem): RedirectResponse
    {
        $this->authorizeStaff('update', $branchMenuItem);

        $branchMenuItem->update($request->validate([
            'available' => ['sometimes', 'boolean'],
            'category_id' => ['sometimes', 'integer', Rule::exists('categories', 'id')->where('branch_id', $branchMenuItem->branch_id)],
        ]));
        MenuAvailabilityChanged::dispatch($branchMenuItem->branch_id);

        return back();
    }

    /**
     * Take the item off this branch's menu. Other branches and past sales keep it.
     */
    public function destroy(BranchMenuItem $branchMenuItem): RedirectResponse
    {
        $this->authorizeStaff('delete', $branchMenuItem);

        $branchMenuItem->delete();
        MenuAvailabilityChanged::dispatch($branchMenuItem->branch_id);

        return back();
    }
}
