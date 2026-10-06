<?php

namespace App\Models;

use App\Enums\MarketingOrderStatus;
use App\Enums\MarketingService;
use Database\Factories\MarketingOrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A bulk or event order a marketing agent sends to a branch. It has no prices; when the branch accepts
 * it, the till prices it and it becomes an unpaid till order (order_id).
 */
class MarketingOrder extends Model
{
    /** @use HasFactory<MarketingOrderFactory> */
    use HasFactory;

    /**
     * Marketing order numbers count on from the prototype's M-500.
     */
    public const NUMBER_OFFSET = 500;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'agent_id',
        'service',
        'customer',
        'phone',
        'address',
        'wanted_on',
        'wanted_at',
        'note',
        'status',
        'order_id',
        'replied_by_id',
        'reply',
        'replied_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'service' => MarketingService::class,
            'status' => MarketingOrderStatus::class,
            'wanted_on' => 'date:Y-m-d',
            'replied_at' => 'datetime',
        ];
    }

    /**
     * "M-501".
     */
    public function number(): string
    {
        return 'M-'.(self::NUMBER_OFFSET + $this->id);
    }

    /**
     * When the customer wants it, such as "Oct 8 · 10:00 AM".
     */
    public function wantedLabel(): string
    {
        return collect([
            $this->wanted_on?->format('M j'),
            $this->wanted_at ? Carbon::createFromFormat('H:i', $this->wanted_at)->format('g:i A') : null,
        ])->filter()->implode(' · ');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * The marketing agent who took the order.
     *
     * @return BelongsTo<User, $this>
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    /**
     * The till order the branch made from it once accepted.
     *
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function repliedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by_id');
    }

    /**
     * @return HasMany<MarketingOrderLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(MarketingOrderLine::class);
    }
}
