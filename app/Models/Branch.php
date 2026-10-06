<?php

namespace App\Models;

use App\Enums\BranchKind;
use App\Enums\BranchStatus;
use Database\Factories\BranchFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A location: a café branch, the warehouse or the commissary.
 */
class Branch extends Model
{
    /** @use HasFactory<BranchFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'kind',
        'address',
        'status',
        'lat',
        'lng',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => BranchKind::class,
            'status' => BranchStatus::class,
            'lat' => 'decimal:7',
            'lng' => 'decimal:7',
        ];
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Category, $this>
     */
    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    /**
     * This branch's menu: which items it sells, in which category, and whether each is available.
     *
     * @return HasMany<BranchMenuItem, $this>
     */
    public function menuEntries(): HasMany
    {
        return $this->hasMany(BranchMenuItem::class);
    }

    /**
     * Add-ons switched off at this branch.
     *
     * @return BelongsToMany<Addon, $this>
     */
    public function disabledAddons(): BelongsToMany
    {
        return $this->belongsToMany(Addon::class, 'branch_addon_off');
    }

    /**
     * @return HasMany<PaymentMethod, $this>
     */
    public function paymentMethods(): HasMany
    {
        return $this->hasMany(PaymentMethod::class);
    }

    /**
     * @return HasMany<PaymentMethodLog, $this>
     */
    public function paymentMethodLogs(): HasMany
    {
        return $this->hasMany(PaymentMethodLog::class);
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * On hand per stock item, from the last approved count.
     *
     * @return HasMany<BranchStock, $this>
     */
    public function stock(): HasMany
    {
        return $this->hasMany(BranchStock::class);
    }
}
