<?php

namespace App\Enums;

/**
 * A daily count sheet: staff fill it in (draft) and submit it, which locks it; the manager then approves
 * it, which posts its endings as on hand, or returns it for a re-count.
 */
enum StockCountStatus: string
{
    case Draft = 'draft';
    case Submitted = 'submitted';
    case Approved = 'approved';
    case Returned = 'returned';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'In progress',
            self::Submitted => 'Awaiting review',
            self::Approved => 'Approved',
            self::Returned => 'Returned for re-count',
        };
    }
}
