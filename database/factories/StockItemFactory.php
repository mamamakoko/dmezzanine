<?php

namespace Database\Factories;

use App\Models\StockItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockItem>
 */
class StockItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'sku' => fake()->unique()->bothify('WH-???-###'),
            'name' => fake()->words(2, true),
            'category' => fake()->randomElement(['Coffee', 'Dairy', 'Baking', 'Kitchen', 'Packaging']),
            'unit' => fake()->randomElement(['kg', 'L', 'pc', 'pack']),
            'cost' => fake()->randomFloat(2, 5, 700),
            'par' => fake()->numberBetween(5, 30),
        ];
    }
}
