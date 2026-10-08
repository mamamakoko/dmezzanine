<?php

namespace App\Models;

use App\Enums\TransferKind;
use App\Enums\TransferStatus;
use Database\Factories\TransferFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Stock moving from one location to another: a requisition one location raises against another, or a
 * commissary batch going to the warehouse. Shared by the till's Stock-in tab and Inventory.
 */
class Transfer extends Model
{
    /** @use HasFactory<TransferFactory> */
    use HasFactory;

    /**
     * Transfer numbers count on from the prototype's TR-1042.
     */
    public const NUMBER_OFFSET = 1042;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'kind',
        'from_branch_id',
        'to_branch_id',
        'status',
        'requested_by_id',
        'approved_by_id',
        'approved_at',
        'issued_by_id',
        'issued_at',
        'closed_by_id',
        'closed_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => TransferKind::class,
            'status' => TransferStatus::class,
            'approved_at' => 'datetime',
            'issued_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * "TR-1043".
     */
    public function number(): string
    {
        return 'TR-'.($this->id + self::NUMBER_OFFSET);
    }

    /**
     * Transfers on their way in: approved, or sent and not all received yet.
     *
     * @param  Builder<Transfer>  $query
     */
    public function scopeIncoming(Builder $query): void
    {
        $query->whereIn('status', [TransferStatus::Approved, TransferStatus::InTransit, TransferStatus::PartiallyReceived]);
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function from(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'from_branch_id');
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function to(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'to_branch_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by_id');
    }

    /**
     * @return HasMany<TransferLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(TransferLine::class);
    }
}
