<?php

namespace App\Enums;

/**
 * The categories on the Owner console's activity log.
 */
enum ActivityKind: string
{
    case Stock = 'stock';
    case Request = 'req';
    case User = 'user';
    case Count = 'count';

    public function label(): string
    {
        return match ($this) {
            self::Stock => 'Stock movement',
            self::Request => 'Request / transfer',
            self::User => 'User management',
            self::Count => 'Stock count',
        };
    }
}
