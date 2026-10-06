<?php

namespace Database\Factories;

use App\Enums\PermissionArea;
use App\Models\Role;
use App\Models\RolePermission;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RolePermission>
 */
class RolePermissionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'role_id' => Role::factory(),
            'area' => fake()->randomElement(PermissionArea::cases()),
            'allowed' => fake()->boolean(),
        ];
    }
}
