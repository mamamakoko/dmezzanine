<?php

namespace App\Enums;

/**
 * A commissary batch: logged to produce, started (its ingredients come off the commissary's stock), ready,
 * then delivered to the warehouse on a transfer.
 */
enum BatchStatus: string
{
    case ToProduce = 'to_produce';
    case InProduction = 'in_production';
    case Ready = 'ready';
    case Delivered = 'delivered';

    public function label(): string
    {
        return match ($this) {
            self::ToProduce => 'To produce',
            self::InProduction => 'In production',
            self::Ready => 'Ready to deliver',
            self::Delivered => 'Delivered',
        };
    }
}
