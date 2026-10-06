<?php

namespace App\Services;

use App\Enums\CountMark;
use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\StockCount;
use App\Models\StockCountLine;
use App\Models\StockItem;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The daily count sheets and the manager's review of them.
 *
 * Usage between two counts is beginning + received − ending. An item's beginning is its ending on the
 * branch's previous counted sheet (submitted or approved; a sheet returned for re-count is skipped), or
 * the branch's on hand when there is none. Received stock and expected usage cover the same days: from
 * the day after that previous sheet up to this one.
 */
class StockLedger
{
    /**
     * An item is off tolerance when its counted usage is more than 5% away from what sales predict.
     */
    public const TOLERANCE = 0.05;

    public function __construct(private UsageService $usage) {}

    /**
     * Save one counted figure on the branch's sheet for today, starting the sheet if needed.
     */
    public function saveCount(Branch $branch, StockItem $item, ?float $counted): StockCount
    {
        return DB::transaction(function () use ($branch, $item, $counted) {
            $sheet = $this->todaysSheet($branch)
                ?? $branch->stockCounts()->create(['day' => BusinessDay::today(), 'status' => StockCountStatus::Draft]);

            if (! $sheet->isOpen()) {
                throw ValidationException::withMessages(['counted' => "Today's sheet is submitted. It's read only now."]);
            }

            $sheet->lines()->updateOrCreate(['stock_item_id' => $item->id], ['counted' => $counted]);

            return $sheet;
        });
    }

    /**
     * Submit and lock today's sheet.
     */
    public function submit(Branch $branch, User $user): StockCount
    {
        $sheet = $this->todaysSheet($branch);

        if ($sheet !== null && ! $sheet->isOpen()) {
            throw ValidationException::withMessages(['sheet' => 'This sheet is already submitted.']);
        }

        if ($sheet === null || ! $sheet->lines()->whereNotNull('counted')->exists()) {
            throw ValidationException::withMessages(['sheet' => 'Count at least one item first.']);
        }

        $sheet->update(['status' => StockCountStatus::Submitted, 'submitted_by_id' => $user->id, 'submitted_at' => now()]);

        return $sheet;
    }

    /**
     * The manager corrects a mis-keyed ending, or marks an item as tallying or flagged.
     *
     * @param  array{adjusted?: ?float, mark?: ?string, note?: ?string}  $changes
     */
    public function review(StockCountLine $line, array $changes): void
    {
        if (! $line->stockCount->isUnderReview()) {
            throw ValidationException::withMessages(['sheet' => 'This sheet is signed off. Reopen the review to change it.']);
        }

        if (array_key_exists('mark', $changes) && $changes['mark'] !== CountMark::Flag->value) {
            $changes['note'] = null;
        }

        $line->update($changes);
    }

    /**
     * Approve the day: its endings become the branch's on hand, which the till shows. An item that already
     * has a newer approved figure keeps it.
     */
    public function approve(StockCount $sheet, User $manager): void
    {
        $this->ensureUnderReview($sheet);

        DB::transaction(function () use ($sheet, $manager) {
            $day = $sheet->day->toDateString();

            foreach ($sheet->lines as $line) {
                $ending = $line->ending();

                if ($ending === null) {
                    continue;
                }

                $onHand = BranchStock::firstOrNew(['branch_id' => $sheet->branch_id, 'stock_item_id' => $line->stock_item_id]);

                if ($onHand->counted_on !== null && $onHand->counted_on->toDateString() > $day) {
                    continue;
                }

                $onHand->fill(['on_hand' => $ending, 'counted_on' => $day, 'counted_by_id' => $sheet->submitted_by_id])->save();
            }

            $sheet->update(['status' => StockCountStatus::Approved, 'reviewed_by_id' => $manager->id, 'reviewed_at' => now()]);
        });
    }

    public function returnForRecount(StockCount $sheet, User $manager): void
    {
        $this->ensureUnderReview($sheet);

        $sheet->update(['status' => StockCountStatus::Returned, 'reviewed_by_id' => $manager->id, 'reviewed_at' => now()]);
    }

    /**
     * Open a signed-off day again so endings and marks can change. On hand that was posted stays until the
     * day is approved again.
     */
    public function reopen(StockCount $sheet): void
    {
        if (! in_array($sheet->status, [StockCountStatus::Approved, StockCountStatus::Returned], true)) {
            throw ValidationException::withMessages(['sheet' => 'Only a signed-off day can be reopened.']);
        }

        $sheet->update(['status' => StockCountStatus::Submitted, 'reviewed_by_id' => null, 'reviewed_at' => null]);
    }

    /**
     * The branch's sheet for today, if anyone has started counting.
     */
    public function todaysSheet(Branch $branch): ?StockCount
    {
        return $branch->stockCounts()->whereDate('day', BusinessDay::today())->first();
    }

    /**
     * The latest sheet before the day that counts as a reliable ending (submitted or approved).
     */
    public function previousSheet(Branch $branch, string $day): ?StockCount
    {
        return $branch->stockCounts()
            ->whereIn('status', [StockCountStatus::Submitted, StockCountStatus::Approved])
            ->whereDate('day', '<', $day)
            ->latest('day')
            ->with('lines')
            ->first();
    }

    /**
     * Each item's beginning for a sheet on the day.
     *
     * @return array<int, float> by stock item id
     */
    public function beginnings(Branch $branch, ?StockCount $previous): array
    {
        $beginnings = $branch->stock()->pluck('on_hand', 'stock_item_id')->map(fn ($qty) => (float) $qty)->all();

        foreach ($previous?->lines ?? [] as $line) {
            if ($line->ending() !== null) {
                $beginnings[$line->stock_item_id] = $line->ending();
            }
        }

        return $beginnings;
    }

    /**
     * Stock received after one day up to and including another.
     *
     * @return array<int, float> by stock item id
     */
    public function received(Branch $branch, ?string $after, string $upTo): array
    {
        return $branch->stockReceipts()
            ->when($after, fn ($query) => $query->whereDate('day', '>', $after), fn ($query) => $query->whereDate('day', $upTo))
            ->whereDate('day', '<=', $upTo)
            ->selectRaw('stock_item_id, SUM(qty) as qty')
            ->groupBy('stock_item_id')
            ->pluck('qty', 'stock_item_id')
            ->map(fn ($qty) => round((float) $qty, 3))
            ->all();
    }

    /**
     * The period a sheet's received stock and expected usage cover: the day after the previous sheet, or
     * just the sheet's own day when there is none.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public function period(?StockCount $previous, string $from, string $to): array
    {
        $start = $previous ? Carbon::parse($previous->day)->addDay()->toDateString() : $from;

        return [BusinessDay::bounds($start)[0], BusinessDay::bounds($to)[1]];
    }

    /**
     * The review rows for one sheet: every counted item with what the shelf and the till say.
     *
     * @return list<array<string, mixed>>
     */
    public function dayRows(StockCount $sheet): array
    {
        $branch = $sheet->branch;
        $day = $sheet->day->toDateString();
        $previous = $this->previousSheet($branch, $day);
        [$from, $to] = $this->period($previous, $day, $day);

        return $this->rows(
            $sheet->lines()->with('stockItem')->whereNotNull('counted')->get(),
            $this->beginnings($branch, $previous),
            $this->received($branch, $previous?->day->toDateString(), $day),
            $this->usage->between($branch, $from, $to),
        );
    }

    /**
     * The month's rows: from the beginning of the month's first sheet to each item's last ending in the
     * month, with the movement of each item's ending across the month's sheets.
     *
     * @param  Collection<int, StockCount>  $sheets  the month's counted sheets, oldest first
     * @return array{rows: list<array<string, mixed>>, series: array<int, list<array{day: string, ending: float}>>}
     */
    public function monthRows(Branch $branch, Collection $sheets): array
    {
        if ($sheets->isEmpty()) {
            return ['rows' => [], 'series' => []];
        }

        $first = $sheets->first()->day->toDateString();
        $last = $sheets->last()->day->toDateString();
        $previous = $this->previousSheet($branch, $first);
        [$from, $to] = $this->period($previous, $first, $last);

        $series = [];
        $lastLines = collect();

        foreach ($sheets as $sheet) {
            foreach ($sheet->lines as $line) {
                if ($line->ending() === null) {
                    continue;
                }

                $series[$line->stock_item_id][] = ['day' => $sheet->day->toDateString(), 'ending' => $line->ending()];
                $lastLines[$line->stock_item_id] = $line;
            }
        }

        $lastLines->each->loadMissing('stockItem');

        $rows = $this->rows(
            $lastLines->values(),
            $this->beginnings($branch, $previous),
            $this->received($branch, $previous?->day->toDateString(), $last),
            $this->usage->between($branch, $from, $to),
        );

        foreach ($rows as &$row) {
            $row['days'] = count($series[$row['stock_item_id']] ?? []);
        }

        return ['rows' => $rows, 'series' => $series];
    }

    /**
     * @param  Collection<int, StockCountLine>  $lines
     * @param  array<int, float>  $beginnings
     * @param  array<int, float>  $received
     * @param  array<int, float>  $expected
     * @return list<array<string, mixed>>
     */
    private function rows(Collection $lines, array $beginnings, array $received, array $expected): array
    {
        return $lines->map(function (StockCountLine $line) use ($beginnings, $received, $expected) {
            $item = $line->stockItem;
            $beginning = $beginnings[$item->id] ?? null;
            $in = $received[$item->id] ?? 0.0;
            $ending = $line->ending();
            $used = $beginning === null || $ending === null ? null : round($beginning + $in - $ending, 3);
            $predicted = isset($expected[$item->id]) ? round($expected[$item->id], 3) : null;
            $gap = $used === null || $predicted === null ? null : round($used - $predicted, 3);

            return [
                'line_id' => $line->id,
                'stock_item_id' => $item->id,
                'sku' => $item->sku,
                'name' => $item->name,
                'unit' => $item->unit,
                'cost' => (float) $item->cost,
                'beginning' => $beginning,
                'received' => $in,
                'counted' => $line->counted === null ? null : (float) $line->counted,
                'adjusted' => $line->adjusted === null ? null : (float) $line->adjusted,
                'ending' => $ending,
                'used' => $used,
                'expected' => $predicted,
                'gap' => $gap,
                'value' => $gap === null ? null : round($gap * (float) $item->cost, 2),
                'off' => $gap !== null && $predicted > 0 && abs($gap / $predicted) > self::TOLERANCE,
                'mark' => $line->mark,
                'note' => $line->note,
            ];
        })->values()->all();
    }

    private function ensureUnderReview(StockCount $sheet): void
    {
        if (! $sheet->isUnderReview()) {
            throw ValidationException::withMessages(['sheet' => $sheet->isOpen()
                ? "This sheet hasn't been submitted yet."
                : 'This day is already signed off. Reopen it first.']);
        }
    }
}
