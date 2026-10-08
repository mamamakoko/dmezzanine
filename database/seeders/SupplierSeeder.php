<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    /**
     * SUPPLIERS from the Inventory prototype: [name, contact, phone, supplies]. Real supplier names are
     * still outstanding (PROJECT-NOTES.md).
     *
     * @var list<array{0: string, 1: string, 2: string, 3: string}>
     */
    public const SUPPLIERS = [
        ['Kalinga Highland Co.', 'Arnel Bituin', '0917 442 8103', 'Coffee'],
        ['Iriga Dairy Supply', 'Divina Racho', '0908 771 2264', 'Dairy · Baking'],
        ['Bicol Trading', 'Ramon Sarmiento', '0919 350 4471', 'Dairy · Baking · Dry goods'],
        ['Sweetline PH', 'Joy Alcantara', '0927 118 6690', 'Syrup · Baking'],
        ['Naga Packaging', 'Edwin Tapales', '0935 802 5517', 'Packaging'],
    ];

    /**
     * Seed the suppliers.
     */
    public function run(): void
    {
        foreach (self::SUPPLIERS as [$name, $contact, $phone, $supplies]) {
            Supplier::updateOrCreate(['name' => $name], ['contact' => $contact, 'phone' => $phone, 'supplies' => $supplies]);
        }
    }
}
