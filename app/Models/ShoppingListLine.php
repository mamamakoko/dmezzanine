<?php

namespace App\Models;

use Database\Factories\ShoppingListLineFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A line on the warehouse's shopping list: a copy of a below-par item taken when it was added (editing the
 * line never changes the item), or a manual line with no item.
 */
class ShoppingListLine extends Model
{
    /** @use HasFactory<ShoppingListLineFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'stock_item_id',
        'name',
        'unit',
        'cost',
        'qty',
        'ticked',
        'reason',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cost' => 'decimal:2',
            'qty' => 'decimal:3',
            'ticked' => 'boolean',
        ];
    }

    /**
     * The location whose stock the line was added from; null for a manual line.
     *
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
}
