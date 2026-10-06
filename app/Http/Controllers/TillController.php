<?php

namespace App\Http\Controllers;

use App\Enums\DrinkSize;
use App\Enums\Milk;
use App\Http\Resources\TillOrderResource;
use App\Models\Addon;
use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\BackOffice;
use App\Services\TillCheckout;
use App\Services\TillSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The branch till. POS and the Branch Menu are the same page; the Branch Menu is order-only, with no
 * prices and no payment, and sends its orders to the cashier.
 */
class TillController extends Controller
{
    /**
     * The POS till. It opens on the PIN pad until a staff member unlocks it.
     */
    public function pos(Request $request, TillSession $till, BackOffice $backOffice): Response
    {
        $staff = $till->staff();
        $branch = $request->user()->branch;
        $canManage = $staff !== null && $branch !== null && $staff->managesBranch($branch->id);
        $tab = $request->query('inv');

        return $this->render($request, $staff, orderOnly: false)->with([
            'canManageBranch' => $canManage,
            'backOffice' => $canManage && in_array($tab, BackOffice::TABS, true)
                ? $backOffice->props($branch, $staff, $tab, [
                    'from' => $this->dateQuery($request, 'from'),
                    'to' => $this->dateQuery($request, 'to'),
                ])
                : null,
        ]);
    }

    /**
     * A Y-m-d date from the query string, or null when it is missing or malformed.
     */
    private function dateQuery(Request $request, string $key): ?string
    {
        $value = $request->query($key);

        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) && strtotime($value) !== false ? $value : null;
    }

    /**
     * The order-only Branch Menu, used by whoever is signed in.
     */
    public function branchMenu(Request $request): Response
    {
        return $this->render($request, $request->user(), orderOnly: true);
    }

    private function render(Request $request, ?User $staff, bool $orderOnly): Response
    {
        $branch = $request->user()->branch;

        if ($branch === null) {
            return Inertia::render('till/index', ['orderOnly' => $orderOnly, 'branch' => null]);
        }

        $receiptOrder = $request->session()->has('receipt_order_id')
            ? $branch->orders()->with(['lines.addons', 'payments', 'cashier'])->find($request->session()->get('receipt_order_id'))
            : null;

        return Inertia::render('till/index', [
            'orderOnly' => $orderOnly,
            'branch' => ['id' => $branch->id, 'name' => $branch->name],
            'staff' => $staff ? ['name' => $staff->name, 'role' => $staff->role->name] : null,
            'canOpenRestrictedTabs' => (bool) $staff?->isBranchLeadOrOwner(),
            'tickets' => TillCheckout::TICKETS,
            'openTickets' => $branch->orders()->holdingTicket()->pluck('ticket')->unique()->values(),
            'nextOrderNo' => $branch->last_order_no + 1,
            ...$this->menu($branch, $orderOnly),
            'paymentMethods' => $orderOnly ? [] : $this->paymentMethods($branch),
            'queue' => $orderOnly || $staff === null ? [] : TillOrderResource::collection(
                $branch->orders()->onQueue()->with(['lines.addons', 'payments', 'cashier'])->latest('id')->get(),
            )->resolve(),
            'receipt' => $receiptOrder === null ? null : ($orderOnly
                ? TillOrderResource::make($receiptOrder)->withoutPrices()
                : TillOrderResource::make($receiptOrder))->resolve(),
        ]);
    }

    /**
     * The branch's available items in its own categories, the add-ons switched on here, and the size
     * and milk choices. Order-only mode leaves out every price.
     *
     * @return array{categories: list<array{id: int, name: string}>, menu: list<array<string, mixed>>, addons: list<array<string, mixed>>, sizes: list<array<string, mixed>>, milks: list<array<string, mixed>>}
     */
    private function menu(Branch $branch, bool $orderOnly): array
    {
        $entries = $branch->menuEntries()
            ->where('available', true)
            ->with(['category', 'menuItem.addons'])
            ->get()
            ->sortBy([fn (BranchMenuItem $entry) => $entry->category->sort, 'sort'])
            ->values();
        $addonsOffHere = $branch->disabledAddons()->pluck('addons.id');
        $price = fn (string|int $amount) => $orderOnly ? [] : ['price' => (float) $amount];

        return [
            'categories' => $entries->pluck('category')->unique('id')->sortBy('sort')
                ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])
                ->values()->all(),
            'menu' => $entries->map(fn (BranchMenuItem $entry) => [
                'id' => $entry->menuItem->id,
                'name' => $entry->menuItem->name,
                'note' => $entry->menuItem->note,
                'category_id' => $entry->category_id,
                'has_modifiers' => $entry->menuItem->has_modifiers,
                'photo_url' => $entry->menuItem->photo_path ? Storage::disk('public')->url($entry->menuItem->photo_path) : null,
                'addon_ids' => $entry->menuItem->addons->pluck('id')->diff($addonsOffHere)->values()->all(),
                ...$price($entry->menuItem->price),
            ])->all(),
            'addons' => Addon::whereNotIn('id', $addonsOffHere)->orderBy('id')->get()
                ->map(fn (Addon $addon) => ['id' => $addon->id, 'name' => $addon->name, ...$price($addon->price)])
                ->all(),
            'sizes' => array_map(fn (DrinkSize $size) => ['value' => $size->value, 'label' => $size->label(), ...$price($size->price())], DrinkSize::cases()),
            'milks' => array_map(fn (Milk $milk) => ['value' => $milk->value, 'label' => $milk->label(), ...$price($milk->price())], Milk::cases()),
        ];
    }

    /**
     * The payment methods switched on at this branch, in the order the branch added them.
     *
     * @return list<array<string, mixed>>
     */
    private function paymentMethods(Branch $branch): array
    {
        return $branch->paymentMethods()->where('active', true)->orderBy('id')->get()
            ->map(fn (PaymentMethod $method) => [
                'id' => $method->id,
                'name' => $method->name,
                'kind' => $method->kind,
                'split' => $method->split,
                'note' => $method->note,
                'terminal' => $method->terminal,
                'wallets' => $method->wallets,
                'tab_limit' => $method->tab_limit === null ? null : (float) $method->tab_limit,
                'lead_only' => $method->lead_only,
            ])->all();
    }
}
