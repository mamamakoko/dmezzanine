<?php

namespace App\Services;

use Illuminate\Support\Carbon;

/**
 * The cafés' business day. Timestamps are stored in UTC; a day runs midnight to midnight in
 * app.business_timezone (Asia/Manila).
 */
final class BusinessDay
{
    /**
     * Today's date where the cafés are, as Y-m-d.
     */
    public static function today(): string
    {
        return Carbon::now(self::timezone())->toDateString();
    }

    /**
     * The first and last moment of a business day, in stored (UTC) time.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function bounds(string $date): array
    {
        $day = Carbon::parse($date, self::timezone());

        return [$day->copy()->startOfDay()->utc(), $day->copy()->endOfDay()->utc()];
    }

    /**
     * The first and last moment of a month (Y-m), in stored (UTC) time.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function monthBounds(string $month): array
    {
        $first = Carbon::parse("{$month}-01", self::timezone());

        return [$first->copy()->startOfMonth()->utc(), $first->copy()->endOfMonth()->utc()];
    }

    private static function timezone(): string
    {
        return config('app.business_timezone');
    }
}
