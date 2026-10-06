<?php

namespace Database\Seeders;

use App\Enums\BranchKind;
use App\Enums\PaymentMethodKind;
use App\Models\Branch;
use Illuminate\Database\Seeder;

class PaymentMethodSeeder extends Seeder
{
    /**
     * PAY_DEFAULTS from the POS prototype, given to every café branch.
     *
     * @var list<array<string, mixed>>
     */
    public const DEFAULTS = [
        ['name' => 'Cash', 'kind' => PaymentMethodKind::Cash, 'split' => true],
        ['name' => 'Card', 'kind' => PaymentMethodKind::Card, 'split' => true, 'terminal' => 'Counter card terminal'],
        ['name' => 'E-wallet', 'kind' => PaymentMethodKind::Qr, 'split' => true, 'wallets' => 'GCash, Maya'],
        ['name' => 'Pay later', 'kind' => PaymentMethodKind::Tab, 'split' => false, 'tab_limit' => 1000, 'lead_only' => true],
    ];

    /**
     * Seed each café branch's payment methods.
     */
    public function run(): void
    {
        Branch::where('kind', BranchKind::Branch)->each(function (Branch $branch) {
            foreach (self::DEFAULTS as $method) {
                $branch->paymentMethods()->updateOrCreate(
                    ['name' => $method['name']],
                    $method + ['active' => true],
                );
            }
        });
    }
}
