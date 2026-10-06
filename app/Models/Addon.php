<?php

namespace App\Models;

use Database\Factories\AddonFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Addon extends Model
{
    /** @use HasFactory<AddonFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
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
     * Menu items that offer this add-on.
     *
     * @return BelongsToMany<MenuItem, $this>
     */
    public function menuItems(): BelongsToMany
    {
        return $this->belongsToMany(MenuItem::class);
    }

    /**
     * Stock items used per serving, with the quantity on the pivot.
     *
     * @return BelongsToMany<StockItem, $this>
     */
    public function parts(): BelongsToMany
    {
        return $this->belongsToMany(StockItem::class, 'addon_parts')->withPivot('qty');
    }

    /**
     * Branches that have switched this add-on off.
     *
     * @return BelongsToMany<Branch, $this>
     */
    public function disabledAtBranches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'branch_addon_off');
    }
}
