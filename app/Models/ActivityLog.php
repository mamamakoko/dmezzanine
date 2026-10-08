<?php

namespace App\Models;

use App\Enums\ActivityKind;
use Database\Factories\ActivityLogFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Something done in the Owner console, or a sign-in. Counts, transfers and deliveries aren't copied here;
 * the activity log reads them from their own tables.
 */
class ActivityLog extends Model
{
    /** @use HasFactory<ActivityLogFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'kind',
        'what',
        'detail',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => ActivityKind::class,
        ];
    }

    /**
     * Record an entry, done by the given user (or by no one, for the system).
     */
    public static function record(ActivityKind $kind, string $what, ?string $detail, ?User $by): self
    {
        return self::create(['kind' => $kind, 'what' => $what, 'detail' => $detail, 'user_id' => $by?->id]);
    }

    /**
     * Who did it.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
