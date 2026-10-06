<?php

namespace App\Enums;

enum MarketingService: string
{
    case Pickup = 'pickup';
    case Delivery = 'delivery';

    public function label(): string
    {
        return match ($this) {
            self::Pickup => 'Pickup',
            self::Delivery => 'Delivery',
        };
    }
}
