<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * First-time passwords and till PINs issued from the Owner console. They are shown to the Owner once
 * and only their hashes are kept.
 */
class Credentials
{
    /**
     * Letters and digits that can't be mistaken for one another when read out (no 0/O, 1/l/I).
     */
    private const PASSWORD_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

    private const PASSWORD_LENGTH = 10;

    public function password(): string
    {
        $password = '';

        for ($i = 0; $i < self::PASSWORD_LENGTH; $i++) {
            $password .= self::PASSWORD_CHARACTERS[random_int(0, strlen(self::PASSWORD_CHARACTERS) - 1)];
        }

        return $password;
    }

    /**
     * A 4-digit PIN no one else on the user's tills uses. The PIN alone says who is unlocking, so it must
     * be unique among a branch's staff and the Owner, who can unlock every branch's till.
     */
    public function pin(User $user): string
    {
        $taken = $this->tillPeers($user)->pluck('pin_hash');

        for ($attempt = 0; $attempt < 50; $attempt++) {
            $pin = (string) random_int(1000, 9999);

            if ($taken->doesntContain(fn (string $hash) => Hash::check($pin, $hash))) {
                return $pin;
            }
        }

        throw new RuntimeException('Could not find a free till PIN. Try again.');
    }

    /**
     * The other active users whose PIN could unlock a till this user unlocks: everyone with a PIN for
     * the Owner; otherwise the user's branch colleagues and the Owner.
     *
     * @return Collection<int, User>
     */
    private function tillPeers(User $user): Collection
    {
        $user->loadMissing('role');

        return User::query()
            ->whereKeyNot($user->id)
            ->where('active', true)
            ->whereNotNull('pin_hash')
            ->when(! $user->isOwner(), fn (Builder $query) => $query->where(fn (Builder $peers) => $peers
                ->when($user->branch_id !== null, fn (Builder $colleagues) => $colleagues->where('branch_id', $user->branch_id))
                ->orWhereHas('role', fn (Builder $role) => $role->where('name', Role::OWNER))))
            ->get(['id', 'pin_hash']);
    }
}
