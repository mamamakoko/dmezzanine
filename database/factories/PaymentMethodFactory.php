<?php

namespace Database\Factories;

use App\Enums\PaymentMethodKind;
use App\Models\Branch;
use App\Models\PaymentMethod;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentMethod>
 */
class PaymentMethodFactory extends Factory
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
            'name' => fake()->unique()->word(),
            'kind' => PaymentMethodKind::Cash,
            'split' => true,
            'note' => null,
            'terminal' => null,
            'wallets' => null,
            'tab_limit' => null,
            'lead_only' => false,
            'active' => true,
        ];
    }

    /**
     * Indicate that the method is a pay-later tab.
     */
    public function tab(): static
    {
        return $this->state(fn (array $attributes) => [
            'kind' => PaymentMethodKind::Tab,
            'split' => false,
            'tab_limit' => 1000,
            'lead_only' => true,
        ]);
    }

    /**
     * Indicate that the branch has switched the method off.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'active' => false,
        ]);
    }
}
