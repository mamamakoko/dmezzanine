<?php

namespace Database\Factories;

use App\Enums\OrderService;
use App\Enums\OrderSource;
use App\Enums\OrderStatus;
use App\Models\Branch;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    /**
     * Define the model's default state: a paid ₱112 till order that is still being prepared.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory(),
            'no' => fake()->unique()->numberBetween(1, 99999),
            'ticket' => fake()->numberBetween(1, 25),
            'service' => OrderService::DineIn,
            'source' => OrderSource::Till,
            'status' => OrderStatus::Preparing,
            'gross' => 112,
            'vat_exempt' => 0,
            'discount' => 0,
            'vat' => 12,
            'total' => 112,
            'senior' => false,
            'unpaid' => false,
            'paid_at' => now(),
        ];
    }

    /**
     * Indicate that the order has been handed over, which frees its ticket.
     */
    public function served(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::Served,
        ]);
    }

    /**
     * Indicate that the order is still waiting for payment.
     */
    public function unpaid(): static
    {
        return $this->state(fn (array $attributes) => [
            'unpaid' => true,
            'paid_at' => null,
        ]);
    }

    /**
     * Indicate that the order was sent to the cashier from the Branch Menu.
     */
    public function fromBranchMenu(): static
    {
        return $this->unpaid()->state(fn (array $attributes) => [
            'source' => OrderSource::BranchMenu,
        ]);
    }
}
