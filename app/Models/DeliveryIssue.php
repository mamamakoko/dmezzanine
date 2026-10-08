<?php

namespace App\Models;

use App\Enums\IssueReason;
use Database\Factories\DeliveryIssueFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A problem flagged on a transfer line, such as a short or damaged delivery. It doesn't change stock.
 */
class DeliveryIssue extends Model
{
    /** @use HasFactory<DeliveryIssueFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'transfer_line_id',
        'reason',
        'note',
        'reported_by_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reason' => IssueReason::class,
        ];
    }

    /**
     * @return BelongsTo<TransferLine, $this>
     */
    public function transferLine(): BelongsTo
    {
        return $this->belongsTo(TransferLine::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reportedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by_id');
    }
}
