<?php

namespace Database\Factories;

use App\Models\ClientType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ClientType>
 */
class ClientTypeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
            'color' => fake()->hexColor(),
            'sort' => 0,
        ];
    }
}
