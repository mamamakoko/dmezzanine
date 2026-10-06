<?php

namespace App\Services;

/**
 * An order's totals in centavos. Menu prices include 12% VAT. A senior/PWD order is VAT-exempt: the VAT
 * is removed, then 20% comes off the amount net of VAT.
 */
final readonly class OrderTotals
{
    public const VAT_RATE = 0.12;

    public const SENIOR_DISCOUNT_RATE = 0.20;

    public function __construct(
        public int $gross,
        public int $vatExempt,
        public int $discount,
        public int $vat,
        public int $total,
    ) {}

    /**
     * Work out the totals from the VAT-inclusive sum of the order's lines.
     */
    public static function fromGross(int $gross, bool $senior): self
    {
        $net = (int) round($gross / (1 + self::VAT_RATE));
        $vat = $gross - $net;

        if (! $senior) {
            return new self($gross, vatExempt: 0, discount: 0, vat: $vat, total: $gross);
        }

        $discount = (int) round($net * self::SENIOR_DISCOUNT_RATE);

        return new self($gross, vatExempt: $vat, discount: $discount, vat: 0, total: $net - $discount);
    }

    /**
     * The totals as order attributes, in pesos.
     *
     * @return array{gross: string, vat_exempt: string, discount: string, vat: string, total: string}
     */
    public function toAttributes(): array
    {
        return [
            'gross' => self::pesos($this->gross),
            'vat_exempt' => self::pesos($this->vatExempt),
            'discount' => self::pesos($this->discount),
            'vat' => self::pesos($this->vat),
            'total' => self::pesos($this->total),
        ];
    }

    /**
     * Convert a peso amount, such as a decimal attribute or request input, to centavos.
     */
    public static function centavos(string|int|float|null $pesos): int
    {
        return (int) round(((float) $pesos) * 100);
    }

    /**
     * Convert centavos to a peso amount for a decimal column.
     */
    public static function pesos(int $centavos): string
    {
        return number_format($centavos / 100, 2, '.', '');
    }

    /**
     * Format centavos the way the till shows money: "₱1,000", or "₱99.50" when there are centavos.
     */
    public static function format(int $centavos): string
    {
        return '₱'.number_format($centavos / 100, $centavos % 100 === 0 ? 0 : 2);
    }
}
