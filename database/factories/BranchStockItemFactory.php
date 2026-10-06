<?php

namespace Database\Factories;

use App\Enums\Station;
use App\Models\Branch;
use App\Models\BranchStockItem;
use App\Models\StockItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BranchStockItem>
 */
class BranchStockItemFactory extends Factory
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
            'station' => Station::Bar,
        ];
    }
}
