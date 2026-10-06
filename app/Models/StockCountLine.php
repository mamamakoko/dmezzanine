<?php

namespace App\Models;

use App\Enums\CountMark;
use Database\Factories\StockCountLineFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One item on a count sheet: what staff counted, the manager's corrected figure if the count was
 * mis-keyed, and the manager's check.
 */
class StockCountLine extends Model
{
    /** @use HasFactory<StockCountLineFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'stock_count_id',
        'stock_item_id',
        'counted',
        'adjusted',
        'mark',
        'note',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'counted' => 'decimal:3',
            'adjusted' => 'decimal:3',
            'mark' => CountMark::class,
        ];
    }

    /**
     * The figure that stands for the day: the manager's correction if there is one, else the count.
     */
    public function ending(): ?float
    {
        return $this->adjusted !== null ? (float) $this->adjusted : ($this->counted !== null ? (float) $this->counted : null);
    }

    /**
     * @return BelongsTo<StockCount, $this>
     */
    public function stockCount(): BelongsTo
    {
        return $this->belongsTo(StockCount::class);
    }

    /**
     * @return BelongsTo<StockItem, $this>
     */
    public function stockItem(): BelongsTo
    {
        return $this->belongsTo(StockItem::class);
    }
}
