<?php

namespace App\Http\Controllers;

use App\Enums\BranchKind;
use App\Http\Requests\SendMarketingOrderRequest;
use App\Http\Resources\MarketingOrderResource;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Services\MarketingOrders;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Marketing takes bulk and event orders off-site and sends them to the branch that will make them.
 * Nothing on this page carries a price; the till applies prices when the branch accepts.
 */
class MarketingController extends Controller
{
    public function show(Request $request): Response
    {
        return Inertia::render('marketing/index', [
            'branches' => Branch::where('kind', BranchKind::Branch)->orderBy('id')->get()->map(fn (Branch $branch) => $this->menuFor($branch))->all(),
            'sent' => MarketingOrderResource::collection(
                $request->user()->marketingOrders()->with(['branch', 'agent', 'repliedBy', 'order', 'lines'])->latest('id')->limit(100)->get(),
            )->resolve(),
        ]);
    }

    public function store(SendMarketingOrderRequest $request, MarketingOrders $orders): RedirectResponse
    {
        $order = $orders->send($request->user(), $request->validated());

        return back()->with('status', "{$order->number()} sent to {$order->branch->name}.");
    }

    /**
     * The branch's available menu in its own categories, and the add-ons switched on there. No prices.
     *
     * @return array<string, mixed>
     */
    private function menuFor(Branch $branch): array
    {
        $entries = $branch->menuEntries()->with(['category', 'menuItem.addons'])->get();
        $available = $entries->where('available', true)->sortBy([fn (BranchMenuItem $entry) => $entry->category->sort, 'sort'])->values();
        $addonsOffHere = $branch->disabledAddons()->pluck('addons.id');

        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'total_items' => $entries->count(),
            'categories' => $available->pluck('category')->unique('id')->sortBy('sort')
                ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])->values()->all(),
            'items' => $available->map(fn (BranchMenuItem $entry) => [
                'id' => $entry->menu_item_id,
                'name' => $entry->menuItem->name,
                'note' => $entry->menuItem->note,
                'category_id' => $entry->category_id,
                'photo_url' => $entry->menuItem->photo_path ? Storage::disk('public')->url($entry->menuItem->photo_path) : null,
                'addon_ids' => $entry->menuItem->addons->pluck('id')->diff($addonsOffHere)->values()->all(),
            ])->all(),
            'addons' => Addon::whereNotIn('id', $addonsOffHere)->orderBy('id')->get(['id', 'name'])->toArray(),
        ];
    }
}
