<?php

namespace Database\Factories;

use App\Enums\PaymentMethodKind;
use App\Models\Order;
use App\Models\OrderPayment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderPayment>
 */
class OrderPaymentFactory extends Factory
{
    /**
     * Define the model's default state: exact cash.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'payment_method_id' => null,
            'method_name' => 'Cash',
            'kind' => PaymentMethodKind::Cash,
            'amount' => 112,
            'tendered' => 112,
            'change' => 0,
        ];
    }
}
