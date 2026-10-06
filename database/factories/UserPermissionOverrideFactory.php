<?php

namespace Database\Factories;

use App\Enums\PermissionArea;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserPermissionOverride>
 */
class UserPermissionOverrideFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'area' => fake()->randomElement(PermissionArea::cases()),
            'allowed' => fake()->boolean(),
        ];
    }
}
