<?php

namespace Database\Factories;

use App\Enums\BranchKind;
use App\Enums\BranchStatus;
use App\Models\Branch;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Branch>
 */
class BranchFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'DMC-'.fake()->unique()->city().' Branch',
            'kind' => BranchKind::Branch,
            'address' => fake()->streetAddress(),
            'status' => BranchStatus::Open,
            'lat' => fake()->latitude(13, 14),
            'lng' => fake()->longitude(123, 124),
        ];
    }

    /**
     * Indicate that the location is a warehouse.
     */
    public function warehouse(): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => BranchKind::Warehouse,
        ]);
    }

    /**
     * Indicate that the location is a commissary.
     */
    public function commissary(): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => BranchKind::Commissary,
        ]);
    }
}
