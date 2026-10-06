<?php

use App\Models\Branch;
use App\Models\Client;
use App\Models\ClientArea;
use App\Models\ClientType;
use App\Models\User;
use App\Services\ClientMap;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;

test('finds who handles a client: their own officer, else the smallest area around them', function (Closure $arrange, ?string $expected) {
    $this->seed(RoleSeeder::class);
    $ana = User::factory()->withRole('Marketing')->create(['name' => 'Ana']);
    $ben = User::factory()->withRole('Marketing')->create(['name' => 'Ben']);
    $client = Client::factory()->create(['lat' => 13.4213, 'lng' => 123.4127]);
    $arrange($client, $ana, $ben);

    $officer = app(ClientMap::class)->officerFor($client->fresh('officer'), ClientArea::with('officer')->get());

    expect($officer['name'] ?? null)->toBe($expected);
})->with([
    'the smaller of two areas around them' => [function (Client $client, User $ana, User $ben) {
        ClientArea::factory()->create(['officer_id' => $ana->id, 'radius_m' => 8000]);
        ClientArea::factory()->create(['officer_id' => $ben->id, 'radius_m' => 1500]);
    }, 'Ben'],
    'their own officer over any area' => [function (Client $client, User $ana, User $ben) {
        ClientArea::factory()->create(['officer_id' => $ben->id, 'radius_m' => 1500]);
        $client->update(['officer_id' => $ana->id]);
    }, 'Ana'],
    'no area reaching them' => [function (Client $client, User $ana) {
        ClientArea::factory()->create(['officer_id' => $ana->id, 'lat' => 13.6218, 'lng' => 123.1948, 'radius_m' => 5000]);
    }, null],
]);

test('lets a marketing agent pin a client', function () {
    $this->seed(RoleSeeder::class);
    $agent = User::factory()->withRole('Marketing')->create();
    $event = ClientType::factory()->create(['name' => 'Event']);

    $this->actingAs($agent)->post('/marketing/clients', ['name' => 'Santos wedding', 'client_type_id' => $event->id, 'lat' => 13.42, 'lng' => 123.41]);

    $this->assertDatabaseHas('clients', ['name' => 'Santos wedding', 'client_type_id' => $event->id, 'added_by_id' => $agent->id]);
});

test('keeps the legend, areas and branch pins to the Owner', function (string $method, Closure $url, array $payload) {
    $this->seed(RoleSeeder::class);
    $agent = User::factory()->withRole('Marketing')->create();

    $response = $this->actingAs($agent)->{$method}($url(), $payload);

    $response->assertForbidden();
})->with([
    'saving the legend' => ['put', fn () => '/marketing/client-types', ['types' => [['name' => 'Event', 'color' => '#336699']]]],
    'drawing an area' => ['post', fn () => '/marketing/areas', ['name' => 'Poblacion', 'lat' => 13.42, 'lng' => 123.41, 'radius_m' => 2000]],
    'moving a branch pin' => ['put', fn () => '/marketing/branches/'.Branch::factory()->create()->id.'/location', ['lat' => 13.5, 'lng' => 123.3]],
]);

test('moves the clients of a removed type to the type the Owner picks', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->create();
    $event = ClientType::factory()->create(['name' => 'Event']);
    $catering = ClientType::factory()->create(['name' => 'Catering']);
    $client = Client::factory()->for($catering, 'type')->create();

    $response = $this->actingAs($owner)->put('/marketing/client-types', [
        'types' => [['id' => $event->id, 'name' => 'Events', 'color' => 'oklch(0.55 0.11 135)']],
        'moves' => [$catering->id => 'events'],
    ]);

    $response->assertSessionHasNoErrors();
    expect($client->fresh()->client_type_id)->toBe($event->id)
        ->and($event->fresh()->name)->toBe('Events');
    $this->assertModelMissing($catering);
});

test('refuses to remove a type in use without somewhere to move its clients', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->create();
    $event = ClientType::factory()->create(['name' => 'Event']);
    $catering = ClientType::factory()->create(['name' => 'Catering']);
    Client::factory()->for($catering, 'type')->create();

    $response = $this->actingAs($owner)->put('/marketing/client-types', ['types' => [['id' => $event->id, 'name' => 'Event', 'color' => '#336699']]]);

    $response->assertSessionHasErrors(['moves' => 'Pick a type for the clients that use Catering.']);
    $this->assertModelExists($catering);
});

test('lets the Owner move a branch pin', function () {
    $this->seed(RoleSeeder::class);
    $owner = User::factory()->withRole('Owner')->create();
    $branch = Branch::factory()->create();

    $this->actingAs($owner)->put("/marketing/branches/{$branch->id}/location", ['lat' => 13.5, 'lng' => 123.3]);

    expect($branch->fresh())->lat->toBe('13.5000000')->lng->toBe('123.3000000');
});

test('shows each client with who handles them', function () {
    $this->seed(RoleSeeder::class);
    $agent = User::factory()->withRole('Marketing')->create(['name' => 'Bea Santos']);
    ClientArea::factory()->create(['name' => 'Poblacion', 'officer_id' => $agent->id, 'radius_m' => 3000]);
    $client = Client::factory()->create(['lat' => 13.4213, 'lng' => 123.4127]);

    $response = $this->actingAs($agent)->get('/marketing/clients');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('marketing/clients')
        ->where('isOwner', false)
        ->where('officers', [['id' => $agent->id, 'name' => 'Bea Santos']])
        ->where('clients.0.id', $client->id)
        ->where('clients.0.officer', ['id' => $agent->id, 'name' => 'Bea Santos', 'via' => 'Poblacion'])
    );
});
