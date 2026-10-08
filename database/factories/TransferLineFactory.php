<?php

namespace Database\Factories;

use App\Models\StockItem;
use App\Models\Transfer;
use App\Models\TransferLine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransferLine>
 */
class TransferLineFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transfer_id' => Transfer::factory(),
            'stock_item_id' => StockItem::factory(),
            'qty' => fake()->numberBetween(1, 12),
        ];
    }
}
