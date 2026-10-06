<?php

namespace App\Models;

use App\Enums\OrderService;
use App\Enums\OrderSource;
use App\Enums\OrderStatus;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A sale, or an order sent to the cashier from the Branch Menu. Prices include VAT; a senior/PWD order
 * has its VAT removed (vat_exempt) and then 20% taken off what is left (discount).
 */
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'no',
        'ticket',
        'service',
        'source',
        'status',
        'cashier_id',
        'settled_by_id',
        'gross',
        'vat_exempt',
        'discount',
        'vat',
        'total',
        'senior',
        'unpaid',
        'tab_name',
        'tab_payment_method_id',
        'note',
        'refund_of',
        'refund_reason',
        'approved_by_id',
        'paid_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service' => OrderService::class,
            'source' => OrderSource::class,
            'status' => OrderStatus::class,
            'gross' => 'decimal:2',
            'vat_exempt' => 'decimal:2',
            'discount' => 'decimal:2',
            'vat' => 'decimal:2',
            'total' => 'decimal:2',
            'senior' => 'boolean',
            'unpaid' => 'boolean',
            'paid_at' => 'datetime',
        ];
    }

    /**
     * Orders that still hold their ticket number: everything not yet served.
     *
     * @param  Builder<Order>  $query
     */
    public function scopeHoldingTicket(Builder $query): void
    {
        $query->where('status', '!=', OrderStatus::Served);
    }

    /**
     * Orders that belong on the queue board: not yet served, or served but still unpaid.
     *
     * @param  Builder<Order>  $query
     */
    public function scopeOnQueue(Builder $query): void
    {
        $query->where(fn (Builder $query) => $query
            ->where('status', '!=', OrderStatus::Served)
            ->orWhere('unpaid', true));
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * The staff member who rang the order up, or who sent it from the Branch Menu.
     *
     * @return BelongsTo<User, $this>
     */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id');
    }

    /**
     * The staff member who took payment for an order that was sent unpaid or put on a tab.
     *
     * @return BelongsTo<User, $this>
     */
    public function settledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by_id');
    }

    /**
     * The pay-later method an unpaid tab was opened with.
     *
     * @return BelongsTo<PaymentMethod, $this>
     */
    public function tabPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'tab_payment_method_id');
    }

    /**
     * The sale this refund gives money back on.
     *
     * @return BelongsTo<Order, $this>
     */
    public function refundOf(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'refund_of');
    }

    /**
     * Refunds given against this sale.
     *
     * @return HasMany<Order, $this>
     */
    public function refunds(): HasMany
    {
        return $this->hasMany(Order::class, 'refund_of');
    }

    /**
     * The manager whose PIN approved this refund.
     *
     * @return BelongsTo<User, $this>
     */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by_id');
    }

    public function isRefund(): bool
    {
        return $this->refund_of !== null;
    }

    /**
     * The marketing order this was made from, when the branch accepted one from its inbox.
     *
     * @return HasOne<MarketingOrder, $this>
     */
    public function marketingOrder(): HasOne
    {
        return $this->hasOne(MarketingOrder::class);
    }

    /**
     * @return HasMany<OrderLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(OrderLine::class);
    }

    /**
     * @return HasMany<OrderPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class);
    }
}
