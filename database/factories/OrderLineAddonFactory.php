<?php

namespace Database\Factories;

use App\Models\OrderLine;
use App\Models\OrderLineAddon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderLineAddon>
 */
class OrderLineAddonFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_line_id' => OrderLine::factory(),
            'addon_id' => null,
            'name' => fake()->words(2, true),
            'price' => 20,
        ];
    }
}
