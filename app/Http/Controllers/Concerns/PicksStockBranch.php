<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\BranchKind;
use App\Models\Branch;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Stock Count and Stock Report run for the user's own branch. The Owner works across branches and picks
 * one (?branch=id), starting on the first café branch.
 */
trait PicksStockBranch
{
    protected function stockBranch(Request $request): ?Branch
    {
        $user = $request->user();

        if (! $user->isOwner()) {
            return $user->branch;
        }

        $cafes = Branch::where('kind', BranchKind::Branch)->orderBy('id');

        return ($request->integer('branch') ? (clone $cafes)->find($request->integer('branch')) : null) ?? $cafes->first();
    }

    /**
     * The café branches the Owner can switch between, or null for everyone else.
     *
     * @return list<array{id: int, name: string}>|null
     */
    protected function branchChoices(User $user): ?array
    {
        return $user->isOwner()
            ? Branch::where('kind', BranchKind::Branch)->orderBy('id')->get(['id', 'name'])->toArray()
            : null;
    }
}
