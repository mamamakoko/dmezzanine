<?php

namespace App\Models;

use Database\Factories\StockItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StockItem extends Model
{
    /** @use HasFactory<StockItemFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'sku',
        'name',
        'category',
        'unit',
        'cost',
        'par',
        'supplier_id',
        'pack_name',
        'pack_size',
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
            'par' => 'decimal:3',
            'pack_size' => 'decimal:3',
        ];
    }

    /**
     * Menu items whose recipe uses this stock item.
     *
     * @return BelongsToMany<MenuItem, $this>
     */
    public function menuItems(): BelongsToMany
    {
        return $this->belongsToMany(MenuItem::class, 'recipes')->withPivot('qty');
    }

    /**
     * @return BelongsTo<Supplier, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /**
     * What the warehouse and the commissary hold of this item.
     *
     * @return HasMany<WarehouseStock, $this>
     */
    public function warehouseStock(): HasMany
    {
        return $this->hasMany(WarehouseStock::class);
    }

    /**
     * The commissary product this item is, when it is a semi-finished product.
     *
     * @return HasOne<Product, $this>
     */
    public function product(): HasOne
    {
        return $this->hasOne(Product::class);
    }
}
