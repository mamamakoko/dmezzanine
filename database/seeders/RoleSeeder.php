<?php

namespace Database\Seeders;

use App\Enums\PermissionArea;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Default page access per role, from ROLE_DEFAULTS in the Landing prototype.
     * Marketing is not in the prototype; its agents only need the Marketing page.
     *
     * @var array<string, list<PermissionArea>>
     */
    public const ROLE_AREAS = [
        'Owner' => [
            PermissionArea::Pos, PermissionArea::Menu, PermissionArea::Marketing, PermissionArea::Inventory,
            PermissionArea::Owner, PermissionArea::Sales, PermissionArea::Count, PermissionArea::Report,
        ],
        'Branch lead' => [
            PermissionArea::Pos, PermissionArea::Menu, PermissionArea::Marketing,
            PermissionArea::Sales, PermissionArea::Count, PermissionArea::Report,
        ],
        'Cashier' => [PermissionArea::Pos, PermissionArea::Menu],
        'Warehouse' => [PermissionArea::Inventory],
        'Commissary' => [PermissionArea::Inventory],
        'Marketing' => [PermissionArea::Marketing],
    ];

    /**
     * Seed the roles and their default permissions.
     */
    public function run(): void
    {
        foreach (self::ROLE_AREAS as $name => $allowedAreas) {
            $role = Role::updateOrCreate(['name' => $name]);

            foreach (PermissionArea::cases() as $area) {
                $role->permissions()->updateOrCreate(
                    ['area' => $area],
                    ['allowed' => in_array($area, $allowedAreas, true)],
                );
            }
        }
    }
}
