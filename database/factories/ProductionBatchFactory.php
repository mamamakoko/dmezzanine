<?php

namespace Database\Factories;

use App\Enums\BatchStatus;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductionBatch;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ProductionBatch>
 */
class ProductionBatchFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory()->commissary(),
            'product_id' => Product::factory(),
            'batches' => 2,
            'status' => BatchStatus::ToProduce,
        ];
    }

    /**
     * Indicate that the batch is made and waiting to go to the warehouse.
     */
    public function ready(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => BatchStatus::Ready,
        ]);
    }
}
