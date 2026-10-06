<?php

namespace App\Models;

use Database\Factories\RoleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    /** @use HasFactory<RoleFactory> */
    use HasFactory;

    /**
     * The Owner always has every area, whatever the overrides say, so the console can't lock them out.
     */
    public const OWNER = 'Owner';

    public const BRANCH_LEAD = 'Branch lead';

    /**
     * Marketing agents; they are the officers on the client map.
     */
    public const MARKETING = 'Marketing';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
    ];

    public function isOwner(): bool
    {
        return $this->name === self::OWNER;
    }

    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * The default page access for users with this role.
     *
     * @return HasMany<RolePermission, $this>
     */
    public function permissions(): HasMany
    {
        return $this->hasMany(RolePermission::class);
    }
}
