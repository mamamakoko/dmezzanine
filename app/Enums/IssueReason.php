<?php

namespace App\Enums;

/**
 * What went wrong with a line that was sent, flagged by either end of the transfer.
 */
enum IssueReason: string
{
    case ShortDelivery = 'short_delivery';
    case Damaged = 'damaged';
    case WrongItem = 'wrong_item';
    case Quality = 'quality';
    case PriceMismatch = 'price_mismatch';

    public function label(): string
    {
        return match ($this) {
            self::ShortDelivery => 'Short delivery',
            self::Damaged => 'Damaged on arrival',
            self::WrongItem => 'Wrong item',
            self::Quality => 'Quality below spec',
            self::PriceMismatch => 'Price mismatch',
        };
    }
}
