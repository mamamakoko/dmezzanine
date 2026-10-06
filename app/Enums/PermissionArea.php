<?php

namespace App\Enums;

/**
 * The app areas a user can be allowed into, as listed on the Owner console.
 */
enum PermissionArea: string
{
    case Pos = 'pos';
    case Menu = 'menu';
    case Marketing = 'marketing';
    case Inventory = 'inventory';
    case Owner = 'owner';
    case Sales = 'sales';
    case Count = 'count';
    case Report = 'report';
}
