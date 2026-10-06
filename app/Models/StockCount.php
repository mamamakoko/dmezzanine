<?php

namespace App\Models;

use App\Enums\StockCountStatus;
use Database\Factories\StockCountFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A branch's count sheet for one day.
 */
class StockCount extends Model
{
    /** @use HasFactory<StockCountFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'day',
        'status',
        'submitted_by_id',
        'submitted_at',
        'reviewed_by_id',
        'reviewed_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'day' => 'date:Y-m-d',
            'status' => StockCountStatus::class,
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * Whether staff can still change the counts: only before the sheet is submitted.
     */
    public function isOpen(): bool
    {
        return $this->status === StockCountStatus::Draft;
    }

    /**
     * Whether the manager can still adjust endings and marks: after submitting, before signing off.
     */
    public function isUnderReview(): bool
    {
        return $this->status === StockCountStatus::Submitted;
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return HasMany<StockCountLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(StockCountLine::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }
}
