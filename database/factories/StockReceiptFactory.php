<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\StockItem;
use App\Models\StockReceipt;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockReceipt>
 */
class StockReceiptFactory extends Factory
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
            'day' => today(config('app.business_timezone'))->toDateString(),
            'qty' => fake()->randomFloat(3, 1, 20),
            'source' => 'Warehouse · Iriga',
        ];
    }
}
