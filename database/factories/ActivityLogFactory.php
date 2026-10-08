<?php

namespace Database\Factories;

use App\Enums\ActivityKind;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
{
    /**
     * Define the model's default state: an invite sent from the Owner console.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'kind' => ActivityKind::User,
            'what' => 'Invite sent',
            'detail' => fake()->safeEmail().' as Cashier',
        ];
    }
}
