<?php

namespace App\Enums;

enum TransferKind: string
{
    /**
     * A location (a branch or the commissary) asks another for stock.
     */
    case Requisition = 'requisition';

    /**
     * A finished commissary batch sent to the warehouse to store.
     */
    case CommissaryOutput = 'commissary_output';

    public function label(): string
    {
        return match ($this) {
            self::Requisition => 'Requisition',
            self::CommissaryOutput => 'Commissary output',
        };
    }
}
