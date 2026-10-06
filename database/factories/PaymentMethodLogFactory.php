<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\PaymentMethod;
use App\Models\PaymentMethodLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentMethodLog>
 */
class PaymentMethodLogFactory extends Factory
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
            'payment_method_id' => fn (array $attributes) => PaymentMethod::factory()->state(['branch_id' => $attributes['branch_id']]),
            'user_id' => User::factory(),
            'description' => fake()->sentence(),
        ];
    }
}
