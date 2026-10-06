<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderLine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderLine>
 */
class OrderLineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'menu_item_id' => null,
            'name' => fake()->words(2, true),
            'size' => null,
            'milk' => null,
            'unit_price' => 112,
            'extras' => 0,
            'qty' => 1,
            'line_total' => 112,
        ];
    }
}
