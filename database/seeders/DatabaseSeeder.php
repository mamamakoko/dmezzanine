<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            BranchSeeder::class,
            UserSeeder::class,
            StockItemSeeder::class,
            MenuSeeder::class,
            AddonSeeder::class,
            PaymentMethodSeeder::class,
            BranchStockSeeder::class,
        ]);
    }
}
