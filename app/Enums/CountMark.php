<?php

namespace App\Enums;

/**
 * The manager's check on a counted item: it tallies with sales, or it is flagged for a re-count.
 */
enum CountMark: string
{
    case Ok = 'ok';
    case Flag = 'flag';
}
