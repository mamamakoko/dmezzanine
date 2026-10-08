<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\StockItem;
use App\Models\WarehouseStock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WarehouseStock>
 */
class WarehouseStockFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory()->warehouse(),
            'stock_item_id' => StockItem::factory(),
            'on_hand' => fake()->numberBetween(10, 60),
            'par' => fake()->numberBetween(5, 30),
            'critical' => null,
        ];
    }
}
