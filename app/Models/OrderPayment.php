<?php

namespace App\Models;

use App\Enums\PaymentMethodKind;
use Database\Factories\OrderPaymentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One payment towards an order; a split payment has several. Amounts are what each method covers, so
 * they add up to the order total. Cash also records what was tendered and the change given back.
 * The method's name is copied so past sales keep it after the branch renames or removes the method.
 */
class OrderPayment extends Model
{
    /** @use HasFactory<OrderPaymentFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'payment_method_id',
        'method_name',
        'kind',
        'amount',
        'tendered',
        'change',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => PaymentMethodKind::class,
            'amount' => 'decimal:2',
            'tendered' => 'decimal:2',
            'change' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<PaymentMethod, $this>
     */
    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }
}
