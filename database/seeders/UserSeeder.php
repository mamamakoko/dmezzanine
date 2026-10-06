<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Demo accounts from the Landing prototype. All share the password "dmezzanine" and till PIN 1234.
     *
     * @var list<array{name: string, email: string, role: string, branch: ?string}>
     */
    public const USERS = [
        ['name' => 'Rico Cortez', 'email' => 'rico@dmezzanine.ph', 'role' => 'Owner', 'branch' => null],
        ['name' => 'Marisol Ganda', 'email' => 'marisol@dmezzanine.ph', 'role' => 'Warehouse', 'branch' => 'Warehouse · Iriga'],
        ['name' => 'Deng Alvarez', 'email' => 'deng@dmezzanine.ph', 'role' => 'Commissary', 'branch' => 'Commissary'],
        ['name' => 'Joy Bermudo', 'email' => 'joy@dmezzanine.ph', 'role' => 'Branch lead', 'branch' => 'DMC-Iriga Branch'],
        ['name' => 'Paolo Rivas', 'email' => 'paolo@dmezzanine.ph', 'role' => 'Cashier', 'branch' => 'DMC-Iriga Branch'],
    ];

    /**
     * Seed the demo users.
     */
    public function run(): void
    {
        $roles = Role::pluck('id', 'name');
        $branches = Branch::pluck('id', 'name');

        foreach (self::USERS as $user) {
            User::updateOrCreate(
                ['email' => $user['email']],
                [
                    'name' => $user['name'],
                    'role_id' => $roles[$user['role']],
                    'branch_id' => $user['branch'] ? $branches[$user['branch']] : null,
                    'password' => 'dmezzanine',
                    'pin_hash' => '1234',
                    'active' => true,
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
