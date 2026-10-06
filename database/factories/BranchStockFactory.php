<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\StockItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BranchStock>
 */
class BranchStockFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory(),
            'stock_item_id' => StockItem::factory(),
            'on_hand' => fake()->randomFloat(3, 0, 30),
            'counted_on' => null,
            'counted_by_id' => null,
        ];
    }
}
