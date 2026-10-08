<?php

namespace App\Models;

use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A semi-finished product the commissary makes in batches, such as cold brew concentrate. Its stock item
 * (WH-SEM-…) is what the warehouse stores; its recipe is the ingredients one batch uses.
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'stock_item_id',
        'servings_per_batch',
        'serving_size',
        'serving_unit',
        'stock_per_batch',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'servings_per_batch' => 'decimal:2',
            'stock_per_batch' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<StockItem, $this>
     */
    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }

    /**
     * The ingredients one batch uses, with the quantity of each (pivot qty).
     *
     * @return BelongsToMany<StockItem, $this>
     */
    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(StockItem::class, 'product_ingredients')->withPivot('qty');
    }

    /**
     * @return HasMany<ProductionBatch, $this>
     */
    public function batches(): HasMany
    {
        return $this->hasMany(ProductionBatch::class);
    }

    /**
     * What one unit of the product's stock costs: one batch's ingredients at cost, over the stock a batch
     * makes.
     */
    public function unitCost(): float
    {
        $batch = $this->ingredients->sum(fn (StockItem $item) => (float) $item->cost * (float) $item->pivot->qty);
        $perBatch = (float) $this->stock_per_batch;

        return round($perBatch > 0 ? $batch / $perBatch : $batch, 2);
    }
}
