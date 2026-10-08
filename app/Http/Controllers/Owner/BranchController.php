<?php

namespace App\Http\Controllers\Owner;

use App\Enums\ActivityKind;
use App\Enums\BranchKind;
use App\Enums\BranchStatus;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Branch;
use App\Services\BranchSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Locations on the Owner console. There is one warehouse and one commissary; any number of café branches.
 * A location's type is fixed once it is added, and archiving keeps its history.
 */
class BranchController extends Controller
{
    public function store(Request $request, BranchSetup $setup): RedirectResponse
    {
        $data = $request->validate([
            'kind' => ['required', Rule::enum(BranchKind::class)],
            ...$this->rules(),
        ]);

        $kind = BranchKind::from($data['kind']);

        if ($kind !== BranchKind::Branch && Branch::where('kind', $kind)->exists()) {
            return back()->withErrors(['kind' => "There is already a {$kind->value}. Add a café branch instead."]);
        }

        $branch = DB::transaction(function () use ($data, $setup) {
            $branch = Branch::create([...$data, 'status' => BranchStatus::Open]);
            $setup->prepare($branch);

            return $branch;
        });

        ActivityLog::record(
            ActivityKind::Stock,
            ucfirst($kind->value)." added — {$branch->name}",
            $branch->isCafe() ? 'Started with the menu, payment methods and count list of the first branch' : 'Starts with no items',
            $request->user(),
        );

        return back();
    }

    public function update(Request $request, Branch $branch): RedirectResponse
    {
        $data = $request->validate([
            ...$this->rules($branch),
            'status' => ['required', Rule::enum(BranchStatus::class)],
        ]);

        $branch->update($data);

        ActivityLog::record(
            ActivityKind::Stock,
            ($branch->status === BranchStatus::Archived ? 'Location archived — ' : 'Location updated — ').$branch->name,
            $branch->status === BranchStatus::Archived
                ? 'Stock and sales history retained'
                : ucfirst($branch->status->value).' · '.($branch->manager?->name ?? 'Unassigned'),
            $request->user(),
        );

        return back();
    }

    /**
     * @return array<string, list<mixed>>
     */
    private function rules(?Branch $branch = null): array
    {
        return [
            'name' => ['required', 'string', 'max:120', Rule::unique('branches', 'name')->ignore($branch)],
            'address' => ['nullable', 'string', 'max:200'],
            'manager_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ];
    }
}
