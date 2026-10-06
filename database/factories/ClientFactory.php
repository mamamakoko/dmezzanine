<?php

namespace Database\Factories;

use App\Models\Client;
use App\Models\ClientType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Client>
 */
class ClientFactory extends Factory
{
    /**
     * Define the model's default state: a client in Iriga City.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'client_type_id' => ClientType::factory(),
            'contact' => fake()->name(),
            'address' => fake()->streetAddress(),
            'lat' => 13.4213,
            'lng' => 123.4127,
        ];
    }
}
