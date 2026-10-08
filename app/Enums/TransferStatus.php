<?php

namespace App\Enums;

/**
 * A transfer between locations. A requisition is requested, approved by the location it asks, then issued
 * (stock leaves the source) and received line by line at the destination (stock arrives). It can be
 * rejected by the source, or cancelled by the requester, until it is issued.
 */
enum TransferStatus: string
{
    case Requested = 'requested';
    case Approved = 'approved';
    case InTransit = 'in_transit';
    case PartiallyReceived = 'partially_received';
    case Received = 'received';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Requested => 'Requested',
            self::Approved => 'Approved',
            self::InTransit => 'In transit',
            self::PartiallyReceived => 'Partially received',
            self::Received => 'Received',
            self::Rejected => 'Rejected',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Whether nothing more can happen to the transfer.
     */
    public function isClosed(): bool
    {
        return in_array($this, [self::Received, self::Rejected, self::Cancelled], true);
    }

    /**
     * Whether stock is on its way and lines can be received.
     */
    public function isReceivable(): bool
    {
        return in_array($this, [self::InTransit, self::PartiallyReceived], true);
    }

    /**
     * Whether the requester can still cancel it, or the source still reject it: nothing has moved yet.
     */
    public function isCancellable(): bool
    {
        return in_array($this, [self::Requested, self::Approved], true);
    }
}
