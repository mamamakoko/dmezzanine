<?php

namespace App\Enums;

enum OrderService: string
{
    case DineIn = 'dine_in';
    case Takeout = 'takeout';

    public function label(): string
    {
        return match ($this) {
            self::DineIn => 'Dine-in',
            self::Takeout => 'Takeout',
        };
    }
}
