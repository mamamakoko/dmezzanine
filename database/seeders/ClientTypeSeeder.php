<?php

namespace Database\Seeders;

use App\Models\ClientType;
use Illuminate\Database\Seeder;

class ClientTypeSeeder extends Seeder
{
    /**
     * TYPES0 from the Client Map prototype: the starting legend.
     *
     * @var array<string, string>
     */
    public const TYPES = [
        'Event' => 'oklch(0.55 0.11 135)',
        'Corporate' => 'oklch(0.5 0.1 250)',
        'Catering' => 'oklch(0.68 0.14 80)',
        'Regular' => 'oklch(0.52 0.12 350)',
    ];

    /**
     * Seed the client types.
     */
    public function run(): void
    {
        foreach (array_keys(self::TYPES) as $sort => $name) {
            ClientType::updateOrCreate(['name' => $name], ['color' => self::TYPES[$name], 'sort' => $sort]);
        }
    }
}
