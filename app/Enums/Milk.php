<?php

namespace App\Enums;

/**
 * MILKS from the POS prototype. Oat replaces fresh milk in the recipe and "No milk" removes it.
 */
enum Milk: string
{
    case Fresh = 'fresh';
    case Oat = 'oat';
    case Skim = 'skim';
    case None = 'none';

    public function label(): string
    {
        return match ($this) {
            self::Fresh => 'Fresh',
            self::Oat => 'Oat',
            self::Skim => 'Skim',
            self::None => 'No milk',
        };
    }

    /**
     * What the milk adds to the item's price, in pesos.
     */
    public function price(): int
    {
        return match ($this) {
            self::Oat => 20,
            default => 0,
        };
    }
}
