<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\PermissionArea;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'role_id',
        'branch_id',
        'name',
        'email',
        'password',
        'pin_hash',
        'active',
        'google_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'pin_hash',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'pin_hash' => 'hashed',
            'active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Role, $this>
     */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /**
     * The user's location. Null for users who work across all locations, such as the Owner.
     *
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Per-user page access that replaces the role's default for that area.
     *
     * @return HasMany<UserPermissionOverride, $this>
     */
    public function permissionOverrides(): HasMany
    {
        return $this->hasMany(UserPermissionOverride::class);
    }

    public function isOwner(): bool
    {
        return $this->role->isOwner();
    }

    /**
     * Whether this user may open a tab on a payment method limited to the Branch lead or Owner.
     */
    public function isBranchLeadOrOwner(): bool
    {
        return $this->isOwner() || $this->role->name === Role::BRANCH_LEAD;
    }

    /**
     * The areas this user may open: the role's defaults, with the user's overrides on top.
     * Inactive users get none; the Owner always gets all.
     *
     * @return list<PermissionArea>
     */
    public function accessibleAreas(): array
    {
        if (! $this->active) {
            return [];
        }

        if ($this->isOwner()) {
            return PermissionArea::cases();
        }

        $allowed = $this->role->permissions->mapWithKeys(
            fn (RolePermission $permission) => [$permission->area->value => $permission->allowed],
        );

        foreach ($this->permissionOverrides as $override) {
            $allowed[$override->area->value] = $override->allowed;
        }

        return array_values(array_filter(
            PermissionArea::cases(),
            fn (PermissionArea $area) => $allowed[$area->value] ?? false,
        ));
    }

    public function canAccess(PermissionArea $area): bool
    {
        return in_array($area, $this->accessibleAreas(), true);
    }
}
