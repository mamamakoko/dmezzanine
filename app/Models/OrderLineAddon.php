<?php

namespace App\Models;

use Database\Factories\OrderLineAddonFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An add-on on an order line, with its name and price as they were when the order was taken.
 */
class OrderLineAddon extends Model
{
    /** @use HasFactory<OrderLineAddonFactory> */
    use HasFactory;

    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_line_id',
        'addon_id',
        'name',
        'price',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<OrderLine, $this>
     */
    public function line(): BelongsTo
    {
        return $this->belongsTo(OrderLine::class, 'order_line_id');
    }

    /**
     * @return BelongsTo<Addon, $this>
     */
    public function addon(): BelongsTo
    {
        return $this->belongsTo(Addon::class);
    }
}
