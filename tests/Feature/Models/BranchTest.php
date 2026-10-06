<?php

use App\Models\Addon;
use App\Models\Branch;
use App\Models\PaymentMethodLog;

test('lists add-ons switched off at the branch without affecting other branches', function () {
    $iriga = Branch::factory()->create();
    $naga = Branch::factory()->create();
    $whippedCream = Addon::factory()->create();

    $iriga->disabledAddons()->attach($whippedCream);

    expect($iriga->disabledAddons->pluck('id')->all())->toBe([$whippedCream->id])
        ->and($naga->disabledAddons)->toBeEmpty()
        ->and($whippedCream->disabledAtBranches->pluck('id')->all())->toBe([$iriga->id]);
});

test('keeps payment method log entries after the method is deleted', function () {
    $log = PaymentMethodLog::factory()->create();

    $log->paymentMethod->delete();

    expect($log->fresh())
        ->payment_method_id->toBeNull()
        ->branch->is($log->branch)->toBeTrue()
        ->user->is($log->user)->toBeTrue();
});
