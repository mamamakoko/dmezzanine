<?php

namespace App\Enums;

/**
 * Where the order came from: the till, which takes payment; the order-only Branch Menu; or a marketing
 * order the branch accepted from its inbox.
 */
enum OrderSource: string
{
    case Till = 'till';
    case BranchMenu = 'branch_menu';
    case Marketing = 'marketing';
}
