<?php

namespace App\Models;

use Database\Factories\MarketingOrderLineFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of a marketing order. Lines are kept per add-on combination; add-ons are stored as
 * [{id, name}] so the line still reads right if an add-on is renamed or removed later.
 */
class MarketingOrderLine extends Model
{
    /** @use HasFactory<MarketingOrderLineFactory> */
    use HasFactory;

    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'marketing_order_id',
        'menu_item_id',
        'name',
        'qty',
        'addons',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'addons' => 'array',
        ];
    }

    /**
     * "Extra shot · Vanilla", or an empty string.
     */
    public function addonsLabel(): string
    {
        return collect($this->addons)->pluck('name')->implode(' · ');
    }

    /**
     * @return BelongsTo<MarketingOrder, $this>
     */
    public function marketingOrder(): BelongsTo
    {
        return $this->belongsTo(MarketingOrder::class);
    }

    /**
     * @return BelongsTo<MenuItem, $this>
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }
}
