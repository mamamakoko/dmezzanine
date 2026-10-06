<?php

namespace App\Enums;

enum BranchKind: string
{
    case Warehouse = 'warehouse';
    case Commissary = 'commissary';
    case Branch = 'branch';
}
