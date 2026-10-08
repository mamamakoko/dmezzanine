<?php

namespace App\Http\Controllers;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Services\BusinessDay;
use App\Services\SalesReport;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Sales reporting: the daily trend, categories, payment methods, top items and the VAT summary. The
 * Owner reports on every café branch or one; everyone else on their own branch only.
 */
class SalesController extends Controller
{
    public const PERIODS = ['today', 'week', 'month'];

    /**
     * The longest custom range, in days, so a mistyped year doesn't build a decade of bars.
     */
    public const MAX_DAYS = 366;

    public function show(Request $request, SalesReport $report): Response
    {
        $user = $request->user();
        $cafes = Branch::where('kind', BranchKind::Branch)->orderBy('id')->get(['id', 'name']);

        if ($user->isOwner()) {
            $branch = $request->query('branch') === null ? null : $cafes->firstWhere('id', $request->integer('branch'));
            $scope = $branch ? [$branch] : $cafes->all();
        } else {
            abort_if($user->branch === null || ! $user->branch->isCafe(), 403, 'Sales are reported per café branch, and your account has no branch.');
            $branch = $user->branch;
            $scope = [$branch];
        }

        [$period, $from, $to] = $this->range($request);

        return Inertia::render('sales', [
            'filters' => [
                'period' => $period,
                'from' => $request->query('from') ? $from : null,
                'to' => $request->query('to') ? $to : null,
                'branch' => $branch?->id,
            ],
            'range' => ['from' => $from, 'to' => $to],
            'today' => BusinessDay::today(),
            'branch' => $branch ? ['id' => $branch->id, 'name' => $branch->name] : null,
            'branches' => $user->isOwner() ? $cafes->toArray() : null,
            'report' => $report->build(array_map(fn (Branch $cafe) => $cafe->id, $scope), $from, $to),
        ]);
    }

    /**
     * The period chip (today, this week from Monday, this month), or a custom range when either date is
     * set. An open-ended range runs from the first of the month, or up to today.
     *
     * @return array{0: string, 1: string, 2: string}
     */
    private function range(Request $request): array
    {
        $today = Carbon::parse(BusinessDay::today());
        $period = in_array($request->query('period'), self::PERIODS, true) ? $request->query('period') : 'today';
        $date = fn (string $key) => preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $request->query($key)) ? Carbon::parse($request->query($key)) : null;
        $from = $date('from');
        $to = $date('to');

        if ($from === null && $to === null) {
            $from = match ($period) {
                'today' => $today->copy(),
                'week' => $today->copy()->startOfWeek(Carbon::MONDAY),
                'month' => $today->copy()->startOfMonth(),
            };

            return [$period, $from->toDateString(), $today->toDateString()];
        }

        $to ??= $today->copy();
        $from ??= $to->copy()->startOfMonth();

        if ($from->greaterThan($to)) {
            [$from, $to] = [$to, $from];
        }

        if ($from->diffInDays($to) >= self::MAX_DAYS) {
            $from = $to->copy()->subDays(self::MAX_DAYS - 1);
        }

        return [$period, $from->toDateString(), $to->toDateString()];
    }
}
