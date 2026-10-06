<?php

namespace App\Enums;

/**
 * A marketing order waits at the branch until the branch accepts it (it joins the till's queue) or
 * declines it. Once accepted, its progress is the till order's.
 */
enum MarketingOrderStatus: string
{
    case Sent = 'sent';
    case Accepted = 'accepted';
    case Declined = 'declined';
}
