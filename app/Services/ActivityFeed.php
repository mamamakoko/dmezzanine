<?php

namespace App\Services;

use App\Enums\ActivityKind;
use App\Enums\StockCountStatus;
use App\Models\ActivityLog;
use App\Models\Delivery;
use App\Models\StockCount;
use App\Models\Transfer;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The Owner console's activity log: what was done in the console and who signed in (activity_logs),
 * merged with the events other pages already record in their own tables: count sheets submitted and
 * approved, transfers requested, approved and sent, and deliveries received.
 */
class ActivityFeed
{
    /**
     * The log shows at most this many entries, newest first.
     */
    public const LIMIT = 300;

    /**
     * @return list<array{id: string, at: string, kind: string, kind_label: string, what: string, detail: ?string, who: string, source: string}>
     */
    public function entries(?string $from, ?string $to): array
    {
        $start = $from ? BusinessDay::bounds($from)[0] : null;
        $end = $to ? BusinessDay::bounds($to)[1] : null;

        $entries = collect()
            ->concat($this->logged($start, $end))
            ->concat($this->counts($start, $end))
            ->concat($this->transfers($start, $end))
            ->concat($this->deliveries($start, $end))
            ->sortByDesc('at')
            ->take(self::LIMIT)
            ->values();

        $names = User::whereIn('id', $entries->pluck('user_id')->filter()->unique())->pluck('name', 'id');

        return $entries->map(fn (array $entry) => [
            'id' => $entry['id'],
            'at' => $entry['at']->toIso8601String(),
            'kind' => $entry['kind']->value,
            'kind_label' => $entry['kind']->label(),
            'what' => $entry['what'],
            'detail' => $entry['detail'],
            'who' => $names[$entry['user_id']] ?? 'System',
            'source' => $entry['source'],
        ])->all();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function logged(?Carbon $start, ?Carbon $end): Collection
    {
        return $this->within(ActivityLog::query(), 'created_at', $start, $end)
            ->get()
            ->map(fn (ActivityLog $log) => $this->entry("LOG-{$log->id}", $log->created_at, $log->kind, $log->what, $log->detail, $log->user_id, $log->what === 'Signed in' ? 'Sign-in' : 'Owner console'));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function counts(?Carbon $start, ?Carbon $end): Collection
    {
        $query = StockCount::with('branch')->withCount(['lines' => fn (Builder $lines) => $lines->whereNotNull('counted')]);

        $submitted = $this->within((clone $query)->whereNotNull('submitted_at'), 'submitted_at', $start, $end)->get()
            ->map(fn (StockCount $count) => $this->entry(
                "COUNT-{$count->id}-S",
                $count->submitted_at,
                ActivityKind::Count,
                "Stock count submitted — {$count->lines_count} items",
                "{$count->branch->name} · {$count->day->format('M j')}",
                $count->submitted_by_id,
                'Stock count',
            ));

        $approved = $this->within((clone $query)->where('status', StockCountStatus::Approved)->whereNotNull('reviewed_at'), 'reviewed_at', $start, $end)->get()
            ->map(fn (StockCount $count) => $this->entry(
                "COUNT-{$count->id}-A",
                $count->reviewed_at,
                ActivityKind::Count,
                'Stock count approved',
                "{$count->branch->name} · {$count->day->format('M j')} · on hand updated",
                $count->reviewed_by_id,
                'Stock report',
            ));

        return $submitted->concat($approved);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function transfers(?Carbon $start, ?Carbon $end): Collection
    {
        $query = Transfer::with(['from', 'to'])->withCount('lines');
        $route = fn (Transfer $transfer) => "{$transfer->number()} · {$transfer->from->name} → {$transfer->to->name}, {$transfer->lines_count} ".($transfer->lines_count === 1 ? 'line' : 'lines');

        $events = [
            ['created_at', 'requested_by_id', 'Transfer requested', 'R'],
            ['approved_at', 'approved_by_id', 'Transfer approved', 'A'],
            ['issued_at', 'issued_by_id', 'Transfer sent', 'I'],
        ];

        return collect($events)->flatMap(fn (array $event) => $this->within((clone $query)->whereNotNull($event[0]), $event[0], $start, $end)->get()
            ->map(fn (Transfer $transfer) => $this->entry(
                "TR-{$transfer->id}-{$event[3]}",
                $transfer->{$event[0]},
                ActivityKind::Request,
                $event[2],
                $route($transfer),
                $transfer->{$event[1]},
                'Inventory',
            )));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function deliveries(?Carbon $start, ?Carbon $end): Collection
    {
        return $this->within(Delivery::with('branch')->withCount('receipts'), 'created_at', $start, $end)->get()
            ->map(fn (Delivery $delivery) => $this->entry(
                "DEL-{$delivery->id}",
                $delivery->created_at,
                ActivityKind::Stock,
                "Stock received — {$delivery->receipts_count} ".($delivery->receipts_count === 1 ? 'line' : 'lines'),
                "{$delivery->branch->name} · from {$delivery->source}",
                $delivery->received_by_id,
                'Stock-in',
            ));
    }

    /**
     * The newest rows of a source within the dates, at most the log's limit.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function within(Builder $query, string $column, ?Carbon $start, ?Carbon $end): Builder
    {
        return $query
            ->when($start, fn (Builder $query) => $query->where($column, '>=', $start))
            ->when($end, fn (Builder $query) => $query->where($column, '<=', $end))
            ->latest($column)
            ->limit(self::LIMIT);
    }

    /**
     * @return array{id: string, at: Carbon, kind: ActivityKind, what: string, detail: ?string, user_id: ?int, source: string}
     */
    private function entry(string $id, Carbon $at, ActivityKind $kind, string $what, ?string $detail, ?int $userId, string $source): array
    {
        return ['id' => $id, 'at' => $at, 'kind' => $kind, 'what' => $what, 'detail' => $detail, 'user_id' => $userId, 'source' => $source];
    }
}
