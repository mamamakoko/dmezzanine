<?php

namespace Database\Factories;

use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MenuItem>
 */
class MenuItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'price' => fake()->numberBetween(80, 220),
            'note' => fake()->sentence(3),
            'has_modifiers' => false,
        ];
    }

    /**
     * Indicate that the till asks for size, milk and add-ons.
     */
    public function withModifiers(): static
    {
        return $this->state(fn (array $attributes) => [
            'has_modifiers' => true,
        ]);
    }
}
