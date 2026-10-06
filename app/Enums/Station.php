<?php

namespace App\Enums;

/**
 * Where an item is counted at a branch, from STATIONS in the Stock Count prototype.
 */
enum Station: string
{
    case Bar = 'bar';
    case Kitchen = 'kitchen';
    case Pastry = 'pastry';
    case Chiller = 'chiller';
    case DryStore = 'dry_store';
    case Packaging = 'packaging';

    public function label(): string
    {
        return match ($this) {
            self::Bar => 'Bar',
            self::Kitchen => 'Kitchen',
            self::Pastry => 'Pastry',
            self::Chiller => 'Chiller',
            self::DryStore => 'Dry store',
            self::Packaging => 'Packaging',
        };
    }
}
