<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Enums\BranchStatus;
use App\Models\Branch;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    /**
     * Locations from the CEO prototype, with branch pins from the Client Map prototype.
     *
     * @var list<array{name: string, kind: BranchKind, address: ?string, lat: ?float, lng: ?float}>
     */
    public const BRANCHES = [
        ['name' => 'Warehouse · Iriga', 'kind' => BranchKind::Warehouse, 'address' => 'Gen. Luna St, San Nicolas, Iriga City', 'lat' => null, 'lng' => null],
        ['name' => 'Commissary', 'kind' => BranchKind::Commissary, 'address' => 'Same compound, second bay', 'lat' => null, 'lng' => null],
        ['name' => 'DMC-Iriga Branch', 'kind' => BranchKind::Branch, 'address' => '2F Mezzanine, Villa Building, Iriga City', 'lat' => 13.4213, 'lng' => 123.4127],
        ['name' => 'DMC-Naga Branch', 'kind' => BranchKind::Branch, 'address' => null, 'lat' => 13.6218, 'lng' => 123.1948],
    ];

    /**
     * Seed the locations.
     */
    public function run(): void
    {
        foreach (self::BRANCHES as $branch) {
            Branch::updateOrCreate(
                ['name' => $branch['name']],
                [
                    'kind' => $branch['kind'],
                    'address' => $branch['address'],
                    'status' => BranchStatus::Open,
                    'lat' => $branch['lat'],
                    'lng' => $branch['lng'],
                ],
            );
        }
    }
}
