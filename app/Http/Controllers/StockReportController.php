<?php

namespace App\Http\Controllers;

use App\Enums\CountMark;
use App\Enums\StockCountStatus;
use App\Events\StockCountApproved;
use App\Http\Controllers\Concerns\PicksStockBranch;
use App\Models\Branch;
use App\Models\StockCount;
use App\Models\StockCountLine;
use App\Models\StockMonthReview;
use App\Services\StockLedger;
use App\Services\UsageService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The manager's review of submitted count sheets: what each item's count says it used against what sales
 * predict. Approving a day posts its endings as the branch's on hand.
 */
class StockReportController extends Controller
{
    use PicksStockBranch;

    public function __construct(private StockLedger $ledger, private UsageService $usage) {}

    public function show(Request $request): Response
    {
        $branch = $this->stockBranch($request);

        if ($branch === null) {
            return Inertia::render('stock-report', ['branch' => null]);
        }

        Gate::authorize('viewStock', $branch);

        /** @var Collection<int, StockCount> $sheets */
        $sheets = $branch->stockCounts()
            ->where('status', '!=', StockCountStatus::Draft)
            ->with(['submittedBy', 'reviewedBy'])
            ->latest('day')
            ->limit(400)
            ->get();
        $days = $sheets->map(fn (StockCount $sheet) => $sheet->day->toDateString());
        $months = $days->map(fn (string $day) => substr($day, 0, 7))->unique()->values();

        $day = in_array($request->query('day'), $days->all(), true) ? $request->query('day') : $days->first();
        $month = in_array($request->query('month'), $months->all(), true) ? $request->query('month') : $months->first();

        return Inertia::render('stock-report', [
            'branch' => ['id' => $branch->id, 'name' => $branch->name],
            'branches' => $this->branchChoices($request->user()),
            'view' => $request->query('view') === 'month' ? 'month' : 'day',
            'canSign' => Gate::allows('manage', $branch),
            'tolerance' => StockLedger::TOLERANCE,
            'days' => $sheets->map(fn (StockCount $sheet) => ['day' => $sheet->day->toDateString(), 'status' => $sheet->status])->all(),
            'months' => $months->all(),
            'dayReport' => $day ? $this->dayReport($sheets->first(fn (StockCount $sheet) => $sheet->day->toDateString() === $day)) : null,
            'monthReport' => $month ? $this->monthReport($branch, $month, $sheets) : null,
        ]);
    }

    /**
     * The manager corrects a mis-keyed ending, marks an item as tallying or flagged, or notes why.
     */
    public function updateLine(Request $request, StockCountLine $stockCountLine): RedirectResponse
    {
        Gate::authorize('manage', $stockCountLine->stockCount->branch);

        $this->ledger->review($stockCountLine, $request->validate([
            'adjusted' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:1000000'],
            'mark' => ['sometimes', 'nullable', Rule::enum(CountMark::class)],
            'note' => ['sometimes', 'nullable', 'string', 'max:200'],
        ]));

        return back();
    }

    public function approve(Request $request, StockCount $stockCount): RedirectResponse
    {
        Gate::authorize('manage', $stockCount->branch);

        $this->ledger->approve($stockCount, $request->user());

        StockCountApproved::dispatch($stockCount->branch_id, $stockCount->day->toDateString());

        return back();
    }

    public function returnForRecount(Request $request, StockCount $stockCount): RedirectResponse
    {
        Gate::authorize('manage', $stockCount->branch);

        $this->ledger->returnForRecount($stockCount, $request->user());

        return back();
    }

    public function reopen(StockCount $stockCount): RedirectResponse
    {
        Gate::authorize('manage', $stockCount->branch);

        $this->ledger->reopen($stockCount);

        return back();
    }

    /**
     * Sign off the month (approve or return it), or reopen it.
     */
    public function signMonth(Request $request, Branch $branch, string $month): RedirectResponse
    {
        Gate::authorize('manage', $branch);

        $status = $request->validate(['status' => ['nullable', Rule::in([StockCountStatus::Approved->value, StockCountStatus::Returned->value])]])['status'] ?? null;

        if ($status === null) {
            StockMonthReview::where('branch_id', $branch->id)->where('month', $month)->delete();
        } else {
            StockMonthReview::updateOrCreate(
                ['branch_id' => $branch->id, 'month' => $month],
                ['status' => $status, 'reviewed_by_id' => $request->user()->id, 'reviewed_at' => now()],
            );
        }

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function dayReport(StockCount $sheet): array
    {
        $day = $sheet->day->toDateString();
        $previous = $this->ledger->previousSheet($sheet->branch, $day);

        return [
            'sheet' => $this->sheetSummary($sheet),
            'since' => $previous?->day->copy()->addDay()->toDateString() ?? $day,
            'rows' => $this->ledger->dayRows($sheet),
            'sales' => $this->usage->salesByItem($sheet->branch, ...$this->ledger->period($previous, $day, $day)),
        ];
    }

    /**
     * @param  Collection<int, StockCount>  $allSheets
     * @return array<string, mixed>
     */
    private function monthReport(Branch $branch, string $month, Collection $allSheets): array
    {
        $sheets = $allSheets
            ->filter(fn (StockCount $sheet) => str_starts_with($sheet->day->toDateString(), $month))
            ->sortBy('day')
            ->values();
        $sheets->load('lines.stockItem');
        $counted = $sheets->filter(fn (StockCount $sheet) => in_array($sheet->status, [StockCountStatus::Submitted, StockCountStatus::Approved], true))->values();
        $first = $sheets->first()->day->toDateString();
        $previous = $this->ledger->previousSheet($branch, $first);
        $review = StockMonthReview::with('reviewedBy')->where('branch_id', $branch->id)->where('month', $month)->first();
        $receivedByDay = $branch->stockReceipts()
            ->whereDate('day', '>=', "{$month}-01")
            ->whereDate('day', '<=', "{$month}-31")
            ->selectRaw('day, COUNT(DISTINCT stock_item_id) as items')
            ->groupBy('day')
            ->pluck('items', 'day')
            ->mapWithKeys(fn ($items, $day) => [substr((string) $day, 0, 10) => (int) $items]);

        return [
            'month' => $month,
            'review' => $review ? [
                'status' => $review->status,
                'status_label' => $review->status->label(),
                'by' => $review->reviewedBy?->name,
                'role' => $review->reviewedBy?->role->name,
                'at' => $review->reviewed_at?->toIso8601String(),
            ] : null,
            ...$this->ledger->monthRows($branch, $counted),
            'sales' => $counted->isEmpty() ? [] : $this->usage->salesByItem($branch, ...$this->ledger->period($previous, $first, $counted->last()->day->toDateString())),
            'sheets' => $sheets->map(fn (StockCount $sheet) => $this->sheetSummary($sheet) + [
                'received_items' => $receivedByDay[$sheet->day->toDateString()] ?? 0,
                'counted' => $sheet->lines->whereNotNull('counted')->count(),
            ])->all(),
        ];
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
            'reviewed_by' => $sheet->reviewedBy?->name,
            'reviewed_role' => $sheet->reviewedBy?->role->name,
            'reviewed_at' => $sheet->reviewed_at?->toIso8601String(),
        ];
    }
}
