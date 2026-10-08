<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'contact' => fake()->name(),
            'phone' => fake()->numerify('0917 ### ####'),
            'supplies' => fake()->randomElement(['Coffee', 'Dairy · Baking', 'Packaging']),
        ];
    }
}
