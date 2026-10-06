<?php

namespace Database\Factories;

use App\Models\ClientArea;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClientArea>
 */
class ClientAreaFactory extends Factory
{
    /**
     * Define the model's default state: a 2 km circle around Iriga with no officer yet.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->city(),
            'officer_id' => null,
            'lat' => 13.4213,
            'lng' => 123.4127,
            'radius_m' => 2000,
        ];
    }
}
