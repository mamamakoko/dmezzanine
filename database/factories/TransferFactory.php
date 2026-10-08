<?php

namespace Database\Factories;

use App\Enums\TransferKind;
use App\Enums\TransferStatus;
use App\Models\Branch;
use App\Models\Transfer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Transfer>
 */
class TransferFactory extends Factory
{
    /**
     * Define the model's default state: a café's new requisition from the warehouse.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'kind' => TransferKind::Requisition,
            'from_branch_id' => Branch::factory()->warehouse(),
            'to_branch_id' => Branch::factory(),
            'status' => TransferStatus::Requested,
        ];
    }

    /**
     * Indicate that the source approved it and has yet to send it.
     */
    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => TransferStatus::Approved,
            'approved_at' => now(),
        ]);
    }

    /**
     * Indicate that the source sent it and nothing is received yet.
     */
    public function inTransit(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => TransferStatus::InTransit,
            'approved_at' => now(),
            'issued_at' => now(),
        ]);
    }
}
