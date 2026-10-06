<?php

namespace Database\Factories;

use App\Models\StockCount;
use App\Models\StockCountLine;
use App\Models\StockItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockCountLine>
 */
class StockCountLineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'stock_count_id' => StockCount::factory(),
            'stock_item_id' => StockItem::factory(),
            'counted' => fake()->randomFloat(3, 0, 30),
        ];
    }
}
