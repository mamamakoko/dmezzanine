<?php

namespace App\Models;

use Database\Factories\MenuItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A menu item shared by every branch. Each branch's category and availability live on BranchMenuItem.
 */
class MenuItem extends Model
{
    /** @use HasFactory<MenuItemFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'price',
        'note',
        'has_modifiers',
        'photo_path',
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
            'has_modifiers' => 'boolean',
        ];
    }

    /**
     * The recipe: stock items used per serving, with the quantity on the pivot.
     *
     * @return BelongsToMany<StockItem, $this>
     */
    public function ingredients(): BelongsToMany
    {
        return $this->belongsToMany(StockItem::class, 'recipes')->withPivot('qty');
    }

    /**
     * Add-ons this item offers.
     *
     * @return BelongsToMany<Addon, $this>
     */
    public function addons(): BelongsToMany
    {
        return $this->belongsToMany(Addon::class);
    }

    /**
     * @return HasMany<BranchMenuItem, $this>
     */
    public function branchEntries(): HasMany
    {
        return $this->hasMany(BranchMenuItem::class);
    }
}
