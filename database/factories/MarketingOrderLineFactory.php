<?php

namespace Database\Factories;

use App\Models\MarketingOrder;
use App\Models\MarketingOrderLine;
use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MarketingOrderLine>
 */
class MarketingOrderLineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'marketing_order_id' => MarketingOrder::factory(),
            'menu_item_id' => MenuItem::factory(),
            'name' => fn (array $attributes) => MenuItem::find($attributes['menu_item_id'])?->name ?? fake()->words(2, true),
            'qty' => fake()->numberBetween(1, 30),
            'addons' => [],
        ];
    }
}
