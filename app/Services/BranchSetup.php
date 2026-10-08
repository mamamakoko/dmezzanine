<?php

namespace App\Services;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\BranchStockItem;
use App\Models\Category;
use App\Models\PaymentMethod;

/**
 * A new café branch starts as a copy of the first café: its categories and menu, its payment methods
 * and the items it counts each day. The branch then changes its own from the till's back office.
 * A new warehouse or commissary starts empty; its staff add their items in Inventory.
 */
class BranchSetup
{
    public function prepare(Branch $branch): void
    {
        if (! $branch->isCafe()) {
            return;
        }

        $template = Branch::where('kind', BranchKind::Branch)
            ->whereKeyNot($branch->id)
            ->orderBy('id')
            ->with(['categories', 'menuEntries', 'paymentMethods', 'stockItems'])
            ->first();

        if ($template === null) {
            return;
        }

        $categories = $template->categories->mapWithKeys(fn (Category $category) => [
            $category->id => $branch->categories()->create($category->only(['name', 'sort'])),
        ]);

        $template->menuEntries->each(fn (BranchMenuItem $entry) => $branch->menuEntries()->create([
            ...$entry->only(['menu_item_id', 'available', 'sort']),
            'category_id' => $categories->get($entry->category_id)?->id,
        ]));

        $template->paymentMethods->each(fn (PaymentMethod $method) => $branch->paymentMethods()->create(
            $method->only(['name', 'kind', 'split', 'note', 'terminal', 'wallets', 'tab_limit', 'lead_only', 'active']),
        ));

        $template->stockItems->each(fn (BranchStockItem $item) => $branch->stockItems()->create($item->only(['stock_item_id', 'station'])));
    }
}
