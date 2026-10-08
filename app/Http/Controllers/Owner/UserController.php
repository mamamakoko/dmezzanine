<?php

namespace App\Http\Controllers\Owner;

use App\Enums\ActivityKind;
use App\Enums\PermissionArea;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Services\Credentials;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Accounts on the Owner console: invite, edit, grant or revoke access, issue a new password or till PIN,
 * and per-user page access. New passwords and PINs are flashed once for the Owner to pass on.
 */
class UserController extends Controller
{
    public function __construct(private Credentials $credentials) {}

    /**
     * Add a user with a first-time password and till PIN. They can sign in straight away.
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $role = Role::findOrFail($data['role_id']);

        if ($role->isOwner()) {
            Gate::authorize('makeOwner', User::class);
        }

        $password = $this->credentials->password();

        [$user, $pin] = DB::transaction(function () use ($data, $password) {
            $user = User::create([...$data, 'password' => $password, 'active' => true]);
            $pin = $this->credentials->pin($user);
            $user->forceFill(['pin_hash' => $pin, 'email_verified_at' => now()])->save();

            return [$user, $pin];
        });

        ActivityLog::record(ActivityKind::User, 'Invite sent', "{$user->email} as {$role->name} · first-time password and PIN issued", $request->user());

        return back()->with('issued', $this->issued($user, 'Invite ready', $password, $pin));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        $data = $this->validated($request, $user);
        $role = Role::findOrFail($data['role_id']);

        if ($role->isOwner() && ! $user->isOwner()) {
            Gate::authorize('makeOwner', User::class);
        }

        if ($user->isOwner() && ! $role->isOwner() && $this->isLastOwner($user)) {
            throw ValidationException::withMessages(['role_id' => 'Keep at least one active Owner. Make someone else an Owner first.']);
        }

        $user->update($data);

        ActivityLog::record(ActivityKind::User, 'User updated', "{$user->email} · {$role->name} · ".($user->branch?->name ?? 'All locations'), $request->user());

        return back();
    }

    /**
     * Grant or revoke access. Revoking signs the user out everywhere and closes the tills they unlocked.
     */
    public function toggle(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('toggleAccess', $user);

        $user->update(['active' => ! $user->active]);

        if (! $user->active && config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
        }

        ActivityLog::record(ActivityKind::User, $user->active ? 'Access granted' : 'Access revoked', "{$user->email} · {$user->role->name}", $request->user());

        return back();
    }

    /**
     * Issue a new password or till PIN, replacing the old one.
     */
    public function credentials(Request $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        $type = $request->validate(['type' => ['required', Rule::in(['password', 'pin'])]])['type'];

        if ($type === 'password') {
            $password = $this->credentials->password();
            $user->update(['password' => $password]);
            ActivityLog::record(ActivityKind::User, 'Password reset', $user->email, $request->user());

            return back()->with('issued', $this->issued($user, 'New password', $password, null));
        }

        $pin = $this->credentials->pin($user);
        $user->update(['pin_hash' => $pin]);
        ActivityLog::record(ActivityKind::User, 'Till PIN reset', $user->email, $request->user());

        return back()->with('issued', $this->issued($user, 'New till PIN', null, $pin));
    }

    /**
     * Open or close one page for the user. A choice that matches the role's default clears the exception.
     */
    public function pages(Request $request, User $user, string $area): RedirectResponse
    {
        Gate::authorize('changePages', $user);

        $area = PermissionArea::tryFrom($area) ?? abort(404);
        $allowed = $request->validate(['allowed' => ['required', 'boolean']])['allowed'];
        $roleDefault = (bool) $user->role->permissions()->where('area', $area)->value('allowed');

        if ((bool) $allowed === $roleDefault) {
            $user->permissionOverrides()->where('area', $area)->delete();
        } else {
            $user->permissionOverrides()->updateOrCreate(['area' => $area], ['allowed' => $allowed]);
        }

        ActivityLog::record(ActivityKind::User, $allowed ? 'Page access granted' : 'Page access removed', "{$user->name} · {$area->label()}", $request->user());

        return back();
    }

    /**
     * @return array{name: string, email: string, role_id: int, branch_id: ?int}
     */
    private function validated(Request $request, ?User $user = null): array
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);

        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', Rule::unique('users', 'email')->ignore($user)],
            'role_id' => ['required', 'integer', Rule::exists('roles', 'id')],
            'branch_id' => ['nullable', 'integer', Rule::exists('branches', 'id')],
        ], [
            'email.unique' => 'Someone already has that email.',
        ]);
    }

    private function isLastOwner(User $user): bool
    {
        return ! User::whereKeyNot($user->id)
            ->where('active', true)
            ->whereHas('role', fn ($query) => $query->where('name', Role::OWNER))
            ->exists();
    }

    /**
     * What the Owner sees once after issuing a password or PIN.
     *
     * @return array{title: string, name: string, email: string, who: string, password: ?string, pin: ?string}
     */
    private function issued(User $user, string $title, ?string $password, ?string $pin): array
    {
        $user->load(['role', 'branch']);

        return [
            'title' => $title,
            'name' => $user->name,
            'email' => $user->email,
            'who' => "{$user->name} · {$user->role->name} · ".($user->branch?->name ?? 'All locations'),
            'password' => $password,
            'pin' => $pin,
        ];
    }
}
