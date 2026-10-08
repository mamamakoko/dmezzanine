<?php

namespace App\Listeners;

use App\Enums\ActivityKind;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Login;

/**
 * Note each sign-in (Google or, in local development, email and password) for the Owner console: the
 * user's last login, and a line in the activity log.
 */
class RecordSignIn
{
    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $event->user->forceFill(['last_login_at' => now()])->save();

        ActivityLog::record(ActivityKind::User, 'Signed in', $event->user->branch?->name ?? 'All locations', $event->user);
    }
}
