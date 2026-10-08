<?php

namespace Database\Factories;

use App\Models\ShoppingListLine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShoppingListLine>
 */
class ShoppingListLineFactory extends Factory
{
    /**
     * Define the model's default state: a manual line.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'unit' => 'pc',
            'cost' => fake()->numberBetween(20, 400),
            'qty' => fake()->numberBetween(1, 10),
            'ticked' => true,
            'reason' => 'Added manually',
        ];
    }
}
