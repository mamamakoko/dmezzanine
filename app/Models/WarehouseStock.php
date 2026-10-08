<?php

namespace App\Models;

use Database\Factories\WarehouseStockFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A stock item held at the warehouse or the commissary, with that location's own low (par) and critical
 * levels. Transfers move it: issuing takes it off the source, receiving adds it at the destination.
 */
class WarehouseStock extends Model
{
    /** @use HasFactory<WarehouseStockFactory> */
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'warehouse_stock';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'stock_item_id',
        'on_hand',
        'par',
        'critical',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'on_hand' => 'decimal:3',
            'par' => 'decimal:3',
            'critical' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return BelongsTo<StockItem, $this>
     */
    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }

    /**
     * The level under which the item is critical: its own, or half its par.
     */
    public function criticalLevel(): float
    {
        return $this->critical === null ? (float) $this->par * 0.5 : (float) $this->critical;
    }

    /**
     * Whether the item is under its low level, so it belongs on the shopping list.
     */
    public function isBelowPar(): bool
    {
        return (float) $this->on_hand < (float) $this->par;
    }
}
