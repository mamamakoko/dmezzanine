<?php

namespace Database\Factories;

use App\Models\Branch;
use App\Models\BranchMenuItem;
use App\Models\Category;
use App\Models\MenuItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<BranchMenuItem>
 */
class BranchMenuItemFactory extends Factory
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
            'menu_item_id' => MenuItem::factory(),
            'category_id' => fn (array $attributes) => Category::factory()->state(['branch_id' => $attributes['branch_id']]),
            'available' => true,
            'sort' => 0,
        ];
    }

    /**
     * Indicate that the branch has marked the item unavailable.
     */
    public function unavailable(): static
    {
        return $this->state(fn (array $attributes) => [
            'available' => false,
        ]);
    }
}
