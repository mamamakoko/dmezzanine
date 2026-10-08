<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\StockItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'stock_item_id' => StockItem::factory()->state(['category' => 'Semi-finished', 'unit' => 'L']),
            'servings_per_batch' => 40,
            'serving_size' => '250',
            'serving_unit' => 'ml',
            'stock_per_batch' => 10,
        ];
    }
}
