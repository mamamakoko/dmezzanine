<?php

namespace Database\Factories;

use App\Enums\MarketingOrderStatus;
use App\Enums\MarketingService;
use App\Models\Branch;
use App\Models\MarketingOrder;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MarketingOrder>
 */
class MarketingOrderFactory extends Factory
{
    /**
     * Define the model's default state: an order waiting in the branch's inbox.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'branch_id' => Branch::factory(),
            'service' => MarketingService::Pickup,
            'customer' => fake()->company(),
            'phone' => '0917 '.fake()->numerify('### ####'),
            'address' => fake()->streetAddress(),
            'wanted_on' => now()->addDay()->toDateString(),
            'wanted_at' => '10:00',
            'status' => MarketingOrderStatus::Sent,
        ];
    }

    /**
     * Indicate that the branch declined the order.
     */
    public function declined(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => MarketingOrderStatus::Declined,
            'reply' => 'cannot take this one — please call the branch',
            'replied_at' => now(),
        ]);
    }
}
