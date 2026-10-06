<?php

namespace App\Enums;

/**
 * Where an order is on the queue board. A ticket number stays taken until its order is served.
 */
enum OrderStatus: string
{
    case Preparing = 'preparing';
    case Ready = 'ready';
    case Served = 'served';

    /**
     * The status the queue board moves the order to next, or null once it is served.
     */
    public function next(): ?self
    {
        return match ($this) {
            self::Preparing => self::Ready,
            self::Ready => self::Served,
            self::Served => null,
        };
    }
}
