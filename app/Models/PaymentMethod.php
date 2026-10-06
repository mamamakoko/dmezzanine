<?php

namespace App\Models;

use App\Enums\PaymentMethodKind;
use Database\Factories\PaymentMethodFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PaymentMethod extends Model
{
    /** @use HasFactory<PaymentMethodFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'name',
        'kind',
        'split',
        'note',
        'terminal',
        'wallets',
        'tab_limit',
        'lead_only',
        'active',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => PaymentMethodKind::class,
            'split' => 'boolean',
            'tab_limit' => 'decimal:2',
            'lead_only' => 'boolean',
            'active' => 'boolean',
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
     * @return HasMany<PaymentMethodLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(PaymentMethodLog::class);
    }
}
