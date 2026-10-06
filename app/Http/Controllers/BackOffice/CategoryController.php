<?php

namespace App\Http\Controllers\BackOffice;

use App\Models\Category;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The branch's own menu categories (the till's category tabs).
 */
class CategoryController extends BackOfficeController
{
    public function store(Request $request): RedirectResponse
    {
        $branch = $this->branch();
        $this->authorizeStaff('manage', $branch);

        $branch->categories()->create([
            'name' => $this->validatedName($request, $branch->id),
            'sort' => (int) $branch->categories()->max('sort') + 1,
        ]);

        return back();
    }

    public function update(Request $request, Category $category): RedirectResponse
    {
        $this->authorizeStaff('update', $category);

        $category->update(['name' => $this->validatedName($request, $category->branch_id, $category)]);

        return back();
    }

    public function destroy(Category $category): RedirectResponse
    {
        $this->authorizeStaff('delete', $category);

        if ($category->menuEntries()->exists()) {
            throw ValidationException::withMessages(['category' => "Move or remove {$category->name}'s items first."]);
        }

        $category->delete();

        return back();
    }

    private function validatedName(Request $request, int $branchId, ?Category $category = null): string
    {
        return trim($request->validate([
            'name' => ['required', 'string', 'max:40', Rule::unique('categories')->where('branch_id', $branchId)->ignore($category)],
        ], [
            'name.required' => 'Give the category a name.',
            'name.unique' => 'This branch already has that category.',
        ])['name']);
    }
}
