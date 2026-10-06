<?php

namespace App\Models;

use App\Enums\DrinkSize;
use App\Enums\Milk;
use Database\Factories\OrderLineFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One line of an order. The name and prices are copied from the menu when the order is taken, so later
 * menu changes don't rewrite past sales. Extras are what size, milk and add-ons add to each unit.
 */
class OrderLine extends Model
{
    /** @use HasFactory<OrderLineFactory> */
    use HasFactory;

    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'menu_item_id',
        'name',
        'size',
        'milk',
        'unit_price',
        'extras',
        'qty',
        'line_total',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'size' => DrinkSize::class,
            'milk' => Milk::class,
            'unit_price' => 'decimal:2',
            'extras' => 'decimal:2',
            'line_total' => 'decimal:2',
        ];
    }

    /**
     * The changes the till shows under the item, such as "Large · Oat · Extra shot", or "No changes".
     */
    public function modsLabel(): string
    {
        $mods = array_filter([
            $this->size === DrinkSize::Regular ? null : $this->size?->label(),
            $this->milk === Milk::Fresh ? null : $this->milk?->label(),
            ...$this->addons->pluck('name'),
        ]);

        return $mods ? implode(' · ', $mods) : 'No changes';
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<MenuItem, $this>
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    /**
     * @return HasMany<OrderLineAddon, $this>
     */
    public function addons(): HasMany
    {
        return $this->hasMany(OrderLineAddon::class);
    }
}
