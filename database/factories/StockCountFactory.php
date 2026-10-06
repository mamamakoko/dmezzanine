<?php

namespace Database\Factories;

use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\StockCount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockCount>
 */
class StockCountFactory extends Factory
{
    /**
     * Define the model's default state: a sheet still being filled in.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory(),
            'day' => today(config('app.business_timezone'))->toDateString(),
            'status' => StockCountStatus::Draft,
        ];
    }

    /**
     * Indicate that staff have submitted the sheet for review.
     */
    public function submitted(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => StockCountStatus::Submitted,
            'submitted_at' => now(),
        ]);
    }

    /**
     * Indicate that the manager has approved the sheet.
     */
    public function approved(): static
    {
        return $this->submitted()->state(fn (array $attributes) => [
            'status' => StockCountStatus::Approved,
            'reviewed_at' => now(),
        ]);
    }
}
