<?php

namespace App\Http\Controllers;

use App\Enums\BranchKind;
use App\Http\Requests\SaveClientRequest;
use App\Models\Branch;
use App\Models\Client;
use App\Models\ClientArea;
use App\Models\ClientType;
use App\Models\Role;
use App\Models\User;
use App\Services\ClientMap;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Marketing's client map: past clients pinned by type, the areas each officer handles, and the branches.
 * Anyone in Marketing records clients; only the Owner edits the legend, draws areas and moves branch pins.
 */
class ClientMapController extends Controller
{
    /**
     * Pin colors: the eight curated swatches, or a custom #rrggbb.
     */
    private const COLOR = '/^(#[0-9a-fA-F]{6}|oklch\(\s*[0-9.]+\s+[0-9.]+\s+[0-9.]+\s*\))$/';

    public function show(Request $request, ClientMap $map): Response
    {
        $areas = ClientArea::with('officer')->orderBy('name')->get();

        return Inertia::render('marketing/clients', [
            'isOwner' => $request->user()->isOwner(),
            'types' => ClientType::withCount('clients')->orderBy('sort')->get()
                ->map(fn (ClientType $type) => ['id' => $type->id, 'name' => $type->name, 'color' => $type->color, 'count' => $type->clients_count])
                ->all(),
            'officers' => $this->officers()->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])->all(),
            'areas' => $areas->map(fn (ClientArea $area) => [
                'id' => $area->id,
                'name' => $area->name,
                'officer_id' => $area->officer_id,
                'officer' => $area->officer?->name,
                'lat' => $area->lat,
                'lng' => $area->lng,
                'radius_m' => $area->radius_m,
            ])->all(),
            'branches' => Branch::where('kind', BranchKind::Branch)->with(['users.role'])->orderBy('id')->get()->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'address' => $branch->address,
                'status' => ucfirst($branch->status->value),
                'manager' => $branch->users->first(fn (User $user) => $user->role->name === Role::BRANCH_LEAD)?->name,
                'staff' => $branch->users->where('active', true)->count(),
                'lat' => $branch->lat === null ? null : (float) $branch->lat,
                'lng' => $branch->lng === null ? null : (float) $branch->lng,
            ])->all(),
            'clients' => Client::with(['officer', 'addedBy'])->latest('last_order_on')->get()->map(fn (Client $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'client_type_id' => $client->client_type_id,
                'contact' => $client->contact,
                'address' => $client->address,
                'lat' => $client->lat,
                'lng' => $client->lng,
                'branch_id' => $client->branch_id,
                'officer_id' => $client->officer_id,
                'officer' => $map->officerFor($client, $areas),
                'last_order_on' => $client->last_order_on?->toDateString(),
                'notes' => $client->notes,
                'added_by' => $client->addedBy?->name,
            ])->all(),
        ]);
    }

    public function storeClient(SaveClientRequest $request): RedirectResponse
    {
        Client::create($request->validated() + ['added_by_id' => $request->user()->id]);

        return back();
    }

    public function updateClient(SaveClientRequest $request, Client $client): RedirectResponse
    {
        $client->update($request->validated());

        return back();
    }

    public function destroyClient(Client $client): RedirectResponse
    {
        $client->delete();

        return back();
    }

    /**
     * Save the legend. Renames carry over to existing clients (they point at the type); a type removed
     * while clients still use it needs another type to move them to.
     */
    public function saveTypes(Request $request): RedirectResponse
    {
        Gate::authorize('manage', ClientType::class);

        $data = $request->validate([
            'types' => ['required', 'array', 'min:1', 'max:20'],
            'types.*.id' => ['nullable', 'integer', 'exists:client_types,id'],
            'types.*.name' => ['required', 'string', 'max:40', 'distinct:ignore_case'],
            'types.*.color' => ['required', 'string', 'regex:'.self::COLOR],
            'moves' => ['array'],
            'moves.*' => ['string'],
        ], [
            'types.min' => 'Keep at least one client type.',
            'types.*.name.required' => 'Give every type a name.',
            'types.*.name.distinct' => 'Two types have the same name.',
            'types.*.color.regex' => 'Pick a color from the swatches or a custom color.',
        ]);

        DB::transaction(function () use ($data) {
            $kept = collect($data['types'])->pluck('id')->filter()->all();
            $saved = [];

            foreach ($data['types'] as $sort => $type) {
                $saved[mb_strtolower(trim($type['name']))] = ClientType::updateOrCreate(
                    ['id' => $type['id'] ?? null],
                    ['name' => trim($type['name']), 'color' => $type['color'], 'sort' => $sort],
                );
            }

            ClientType::whereNotIn('id', $kept)->whereNotIn('id', collect($saved)->pluck('id'))->each(function (ClientType $removed) use ($data, $saved) {
                if ($removed->clients()->exists()) {
                    $target = $saved[mb_strtolower(trim($data['moves'][$removed->id] ?? ''))] ?? null;

                    if ($target === null) {
                        throw ValidationException::withMessages(['moves' => "Pick a type for the clients that use {$removed->name}."]);
                    }

                    $removed->clients()->update(['client_type_id' => $target->id]);
                }

                $removed->delete();
            });
        });

        return back();
    }

    public function storeArea(Request $request): RedirectResponse
    {
        Gate::authorize('create', ClientArea::class);

        ClientArea::create($this->validatedArea($request));

        return back();
    }

    public function updateArea(Request $request, ClientArea $clientArea): RedirectResponse
    {
        Gate::authorize('update', $clientArea);

        $clientArea->update($this->validatedArea($request));

        return back();
    }

    public function destroyArea(ClientArea $clientArea): RedirectResponse
    {
        Gate::authorize('delete', $clientArea);

        $clientArea->delete();

        return back();
    }

    /**
     * "Change location": move a branch's pin. Branch pins can't be dragged.
     */
    public function moveBranch(Request $request, Branch $branch): RedirectResponse
    {
        Gate::authorize('moveOnMap', $branch);

        $branch->update($request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
        ]));

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedArea(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'officer_id' => ['nullable', 'integer', Rule::in($this->officers()->pluck('id')->all())],
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'radius_m' => ['required', 'integer', 'between:300,15000'],
        ], [
            'name.required' => 'Give the area a name.',
            'officer_id.in' => 'Officers are users with the Marketing role.',
        ]);
    }

    /**
     * Marketing officers: active users with the Marketing role.
     *
     * @return Collection<int, User>
     */
    private function officers(): Collection
    {
        return User::where('active', true)->whereHas('role', fn ($query) => $query->where('name', Role::MARKETING))->orderBy('name')->get();
    }
}
