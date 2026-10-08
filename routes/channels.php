<?php

use App\Enums\PermissionArea;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

/*
 * A branch's live updates (its queue, inbox, menu and stock) go to the branch's own staff and the Owner.
 */
Broadcast::channel('branch.{branch}', function (User $user, Branch $branch) {
    return $user->active && ($user->isOwner() || $user->branch_id === $branch->id);
});

/*
 * Replies to marketing orders and menu changes, for anyone with Marketing open.
 */
Broadcast::channel('marketing', function (User $user) {
    return $user->canAccess(PermissionArea::Marketing);
});
