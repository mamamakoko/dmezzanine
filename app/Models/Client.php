<?php

namespace App\Models;

use Database\Factories\ClientFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A past client pinned on the marketing map. officer_id is an override; without one, the client belongs
 * to the officer of the smallest area containing it (ClientMap::officerFor).
 */
class Client extends Model
{
    /** @use HasFactory<ClientFactory> */
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'client_type_id',
        'officer_id',
        'branch_id',
        'contact',
        'address',
        'lat',
        'lng',
        'last_order_on',
        'notes',
        'added_by_id',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'lat' => 'float',
            'lng' => 'float',
            'last_order_on' => 'date:Y-m-d',
        ];
    }

    /**
     * @return BelongsTo<ClientType, $this>
     */
    public function type(): BelongsTo
    {
        return $this->belongsTo(ClientType::class, 'client_type_id');
    }

    /**
     * The officer assigned to this client directly, overriding any area.
     *
     * @return BelongsTo<User, $this>
     */
    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }

    /**
     * The branch that serves the client.
     *
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by_id');
    }
}
