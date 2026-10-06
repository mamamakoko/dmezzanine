<?php

namespace Database\Factories;

use App\Enums\StockCountStatus;
use App\Models\Branch;
use App\Models\StockMonthReview;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockMonthReview>
 */
class StockMonthReviewFactory extends Factory
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
            'month' => today(config('app.business_timezone'))->format('Y-m'),
            'status' => StockCountStatus::Approved,
            'reviewed_at' => now(),
        ];
    }
}
