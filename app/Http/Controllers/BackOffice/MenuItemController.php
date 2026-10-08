<?php

namespace App\Http\Controllers\BackOffice;

use App\Events\MenuAvailabilityChanged;
use App\Models\MenuItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Menu items are shared by every branch: name, price, description, photo, recipe and the add-ons each
 * offers. Only the Owner changes them; the category is this branch's own.
 */
class MenuItemController extends BackOfficeController
{
    /**
     * Photos are cropped to 16:9 on the till and must be at least this size.
     */
    public const PHOTO_WIDTH = 800;

    public const PHOTO_HEIGHT = 450;

    /**
     * Create an item and put it on this branch's menu.
     */
    public function store(Request $request): RedirectResponse
    {
        $this->authorizeStaff('create', MenuItem::class);
        $branch = $this->branch();

        DB::transaction(function () use ($request, $branch) {
            $item = new MenuItem;
            $categoryId = $this->save($item, $request);

            $branch->menuEntries()->create([
                'menu_item_id' => $item->id,
                'category_id' => $categoryId,
                'available' => true,
                'sort' => (int) $branch->menuEntries()->max('sort') + 1,
            ]);
        });

        MenuAvailabilityChanged::everywhere();

        return back();
    }

    public function update(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $this->authorizeStaff('update', $menuItem);
        $branch = $this->branch();

        DB::transaction(function () use ($request, $menuItem, $branch) {
            $categoryId = $this->save($menuItem, $request);
            $branch->menuEntries()->where('menu_item_id', $menuItem->id)->update(['category_id' => $categoryId]);
        });

        MenuAvailabilityChanged::everywhere();

        return back();
    }

    /**
     * Upload the item's tile photo to storage/app/public.
     */
    public function storePhoto(Request $request, MenuItem $menuItem): RedirectResponse
    {
        $this->authorizeStaff('update', $menuItem);

        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120', 'dimensions:min_width='.self::PHOTO_WIDTH.',min_height='.self::PHOTO_HEIGHT],
        ], [
            'photo.dimensions' => 'The photo needs to be at least '.self::PHOTO_WIDTH.'×'.self::PHOTO_HEIGHT.'.',
            'photo.max' => 'The photo is too large. Keep it under 5 MB.',
        ]);

        $previous = $menuItem->photo_path;
        $menuItem->update(['photo_path' => $request->file('photo')->store('menu-photos', 'public')]);

        if ($previous) {
            Storage::disk('public')->delete($previous);
        }

        MenuAvailabilityChanged::everywhere();

        return back();
    }

    public function destroyPhoto(MenuItem $menuItem): RedirectResponse
    {
        $this->authorizeStaff('update', $menuItem);

        if ($menuItem->photo_path) {
            Storage::disk('public')->delete($menuItem->photo_path);
            $menuItem->update(['photo_path' => null]);
        }

        MenuAvailabilityChanged::everywhere();

        return back();
    }

    /**
     * Save the shared fields, recipe and add-ons, and return the category picked for this branch.
     */
    private function save(MenuItem $item, Request $request): int
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('menu_items')->ignore($item)],
            'price' => ['required', 'numeric', 'min:0', 'max:100000'],
            'note' => ['nullable', 'string', 'max:120'],
            'has_modifiers' => ['boolean'],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')->where('branch_id', $this->branch()->id)],
            'recipe' => ['array'],
            'recipe.*.stock_item_id' => ['required', 'integer', 'distinct', 'exists:stock_items,id'],
            'recipe.*.qty' => ['required', 'numeric', 'gt:0', 'max:100000'],
            'addon_ids' => ['array'],
            'addon_ids.*' => ['integer', 'distinct', 'exists:addons,id'],
        ], [
            'name.required' => 'Give the item a name.',
            'name.unique' => 'There is already a menu item with that name.',
            'category_id.required' => 'Pick a category.',
            'recipe.*.qty.gt' => 'Each ingredient needs an amount per serving.',
        ]);

        $item->fill([
            'name' => trim($data['name']),
            'price' => $data['price'],
            'note' => $data['note'] ?? null,
            'has_modifiers' => $data['has_modifiers'] ?? false,
        ])->save();

        $item->ingredients()->sync(collect($data['recipe'] ?? [])->mapWithKeys(fn (array $part) => [$part['stock_item_id'] => ['qty' => $part['qty']]])->all());
        $item->addons()->sync($item->has_modifiers ? ($data['addon_ids'] ?? []) : []);

        return $data['category_id'];
    }
}
