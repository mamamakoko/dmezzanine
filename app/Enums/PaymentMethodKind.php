<?php

namespace App\Enums;

enum PaymentMethodKind: string
{
    case Cash = 'cash';
    case Card = 'card';
    case Qr = 'qr';
    case Tab = 'tab';
    case Other = 'other';
}
