<?php

namespace App\Enums;

/**
 * Which screen sent the order: the till, which takes payment, or the order-only Branch Menu.
 */
enum OrderSource: string
{
    case Till = 'till';
    case BranchMenu = 'branch_menu';
}
