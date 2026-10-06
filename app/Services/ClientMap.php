<?php

namespace App\Services;

use App\Models\Client;
use App\Models\ClientArea;
use Illuminate\Support\Collection;

/**
 * Who handles each client on the marketing map: the officer assigned to the client directly, otherwise
 * the officer of the smallest area containing the client.
 */
class ClientMap
{
    private const EARTH_RADIUS_M = 6371008.8;

    /**
     * @param  Collection<int, ClientArea>  $areas  with officer loaded
     * @return array{id: int, name: string, via: ?string}|null via is the area's name, or null when assigned directly
     */
    public function officerFor(Client $client, Collection $areas): ?array
    {
        if ($client->officer) {
            return ['id' => $client->officer->id, 'name' => $client->officer->name, 'via' => null];
        }

        $area = $this->areaFor($client, $areas);

        return $area?->officer ? ['id' => $area->officer->id, 'name' => $area->officer->name, 'via' => $area->name] : null;
    }

    /**
     * The smallest area the client's pin falls inside.
     *
     * @param  Collection<int, ClientArea>  $areas
     */
    public function areaFor(Client $client, Collection $areas): ?ClientArea
    {
        return $areas
            ->filter(fn (ClientArea $area) => $this->distance($client->lat, $client->lng, $area->lat, $area->lng) <= $area->radius_m)
            ->sortBy('radius_m')
            ->first();
    }

    /**
     * Great-circle distance in metres, as Leaflet's distanceTo measures it.
     */
    public function distance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
