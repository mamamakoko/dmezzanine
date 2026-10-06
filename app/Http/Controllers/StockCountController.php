<?php

namespace App\Http\Controllers;

use App\Enums\Station;
use App\Enums\StockCountStatus;
use App\Http\Controllers\Concerns\PicksStockBranch;
use App\Models\Branch;
use App\Models\BranchStockItem;
use App\Models\StockCount;
use App\Models\StockItem;
use App\Services\BusinessDay;
use App\Services\StockLedger;
use App\Services\UsageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The daily stock count: staff count each item at the branch's stations and submit the sheet, which locks
 * it for the manager's review in the Stock Report.
 */
class StockCountController extends Controller
{
    use PicksStockBranch;

    public function __construct(private StockLedger $ledger, private UsageService $usage) {}

    public function show(Request $request): Response
    {
        $branch = $this->stockBranch($request);

        if ($branch === null) {
            return Inertia::render('stock-count', ['branch' => null]);
        }

        Gate::authorize('viewStock', $branch);

        $today = BusinessDay::today();
        $sheet = $this->ledger->todaysSheet($branch)?->load(['lines', 'submittedBy']);
        $previous = $this->ledger->previousSheet($branch, $today)?->load('submittedBy');
        $beginnings = $this->ledger->beginnings($branch, $previous);
        $usedToday = $this->usage->forDay($branch, $today);
        $counted = $sheet?->lines->pluck('counted', 'stock_item_id') ?? collect();

        $roster = $branch->stockItems()->with('stockItem')->get()->keyBy('stock_item_id');
        $items = $roster->map(fn (BranchStockItem $entry) => $entry->stockItem)
            ->concat(StockItem::whereIn('id', array_diff(array_keys($usedToday), $roster->keys()->all()))->get())
            ->sortBy('name')
            ->map(fn (StockItem $item) => [
                'id' => $item->id,
                'sku' => $item->sku,
                'name' => $item->name,
                'unit' => $item->unit,
                'station' => $roster->get($item->id)?->station,
                'beginning' => $beginnings[$item->id] ?? null,
                'counted' => $counted->get($item->id) === null ? null : (float) $counted->get($item->id),
                'used_today' => $usedToday[$item->id] ?? null,
            ])
            ->values();

        return Inertia::render('stock-count', [
            'branch' => ['id' => $branch->id, 'name' => $branch->name],
            'branches' => $this->branchChoices($request->user()),
            'today' => $today,
            'stations' => array_map(fn (Station $station) => ['value' => $station->value, 'label' => $station->label()], Station::cases()),
            'items' => $items,
            'sheet' => $sheet ? $this->sheetSummary($sheet) : null,
            'previous' => $previous ? ['day' => $previous->day->toDateString(), 'status' => $previous->status->label(), 'by' => $previous->submittedBy?->name] : null,
            'history' => $branch->stockCounts()
                ->where('status', '!=', StockCountStatus::Draft)
                ->with('submittedBy')
                ->withCount(['lines as counted_count' => fn ($query) => $query->whereNotNull('counted')])
                ->withCount(['lines as flagged_count' => fn ($query) => $query->where('mark', 'flag')])
                ->latest('day')
                ->limit(60)
                ->get()
                ->map(fn (StockCount $count) => $this->sheetSummary($count) + ['flagged' => $count->flagged_count])
                ->all(),
        ]);
    }

    /**
     * Save one counted figure on today's sheet. A blank clears it.
     */
    public function updateLine(Request $request, Branch $branch, StockItem $stockItem): RedirectResponse
    {
        Gate::authorize('viewStock', $branch);

        $counted = $request->validate(['counted' => ['nullable', 'numeric', 'min:0', 'max:1000000']], [
            'counted.numeric' => 'Enter the count as a number.',
            'counted.min' => "A count can't be below zero.",
        ])['counted'];

        $this->ledger->saveCount($branch, $stockItem, $counted === null ? null : (float) $counted);

        return back();
    }

    /**
     * Submit and lock today's sheet for the manager's review.
     */
    public function submit(Request $request, Branch $branch): RedirectResponse
    {
        Gate::authorize('viewStock', $branch);

        $this->ledger->submit($branch, $request->user());

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function sheetSummary(StockCount $sheet): array
    {
        return [
            'id' => $sheet->id,
            'day' => $sheet->day->toDateString(),
            'status' => $sheet->status,
            'status_label' => $sheet->status->label(),
            'by' => $sheet->submittedBy?->name,
            'at' => $sheet->submitted_at?->toIso8601String(),
            'counted' => $sheet->counted_count ?? $sheet->lines->whereNotNull('counted')->count(),
        ];
    }
}
