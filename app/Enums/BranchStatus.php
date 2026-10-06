<?php

namespace App\Enums;

enum BranchStatus: string
{
    case Open = 'open';
    case Closed = 'closed';
    case Archived = 'archived';
}
