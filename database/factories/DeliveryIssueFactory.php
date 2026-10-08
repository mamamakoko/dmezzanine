<?php

namespace Database\Factories;

use App\Enums\IssueReason;
use App\Models\DeliveryIssue;
use App\Models\TransferLine;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DeliveryIssue>
 */
class DeliveryIssueFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'transfer_line_id' => TransferLine::factory(),
            'reason' => IssueReason::ShortDelivery,
            'note' => fake()->sentence(),
        ];
    }
}
