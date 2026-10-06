<?php

namespace App\Enums;

/**
 * SIZES from the POS prototype, for items that ask for size, milk and add-ons.
 */
enum DrinkSize: string
{
    case Regular = 'regular';
    case Large = 'large';
    case Tall = 'tall';

    public function label(): string
    {
        return match ($this) {
            self::Regular => 'Regular',
            self::Large => 'Large',
            self::Tall => 'Tall 16oz',
        };
    }

    /**
     * What the size adds to the item's price, in pesos.
     */
    public function price(): int
    {
        return match ($this) {
            self::Regular => 0,
            self::Large => 25,
            self::Tall => 40,
        };
    }
}
