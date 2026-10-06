<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * The Owner's account and the demo staff from the Landing prototype (where the Owner was Rico Cortez),
     * all with the password "dmezzanine". Till PINs must be
     * unique among the people who can unlock a branch's till (its POS staff and the Owner), because the
     * PIN alone identifies who is unlocking.
     *
     * @var list<array{name: string, email: string, role: string, branch: ?string, pin: string}>
     */
    public const USERS = [
        ['name' => 'John Francis Lomeda', 'email' => 'kokoylemonada@gmail.com', 'role' => 'Owner', 'branch' => null, 'pin' => '9999'],
        ['name' => 'Marisol Ganda', 'email' => 'marisol@dmezzanine.ph', 'role' => 'Warehouse', 'branch' => 'Warehouse · Iriga', 'pin' => '1234'],
        ['name' => 'Deng Alvarez', 'email' => 'deng@dmezzanine.ph', 'role' => 'Commissary', 'branch' => 'Commissary', 'pin' => '1234'],
        ['name' => 'Joy Bermudo', 'email' => 'joy@dmezzanine.ph', 'role' => 'Branch lead', 'branch' => 'DMC-Iriga Branch', 'pin' => '5678'],
        ['name' => 'Paolo Rivas', 'email' => 'paolo@dmezzanine.ph', 'role' => 'Cashier', 'branch' => 'DMC-Iriga Branch', 'pin' => '1234'],
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
                    'pin_hash' => $user['pin'],
                    'active' => true,
                    'email_verified_at' => now(),
                ],
            );
        }
    }
}
