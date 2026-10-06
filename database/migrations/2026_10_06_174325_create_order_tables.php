<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->unsignedInteger('no');
            $table->unsignedTinyInteger('ticket');
            $table->string('service');
            $table->string('source');
            $table->string('status')->default('preparing');
            $table->foreignId('cashier_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('settled_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('gross', 10, 2);
            $table->decimal('vat_exempt', 10, 2)->default(0);
            $table->decimal('discount', 10, 2)->default(0);
            $table->decimal('vat', 10, 2);
            $table->decimal('total', 10, 2);
            $table->boolean('senior')->default(false);
            $table->boolean('unpaid')->default(false);
            $table->string('tab_name')->nullable();
            $table->foreignId('tab_payment_method_id')->nullable()->constrained('payment_methods')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'no']);
            $table->index(['branch_id', 'status', 'ticket']);
        });

        Schema::create('order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('size')->nullable();
            $table->string('milk')->nullable();
            $table->decimal('unit_price', 10, 2);
            $table->decimal('extras', 10, 2)->default(0);
            $table->unsignedSmallInteger('qty');
            $table->decimal('line_total', 10, 2);
        });

        Schema::create('order_line_addons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_line_id')->constrained()->cascadeOnDelete();
            $table->foreignId('addon_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->decimal('price', 10, 2);
        });

        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('method_name');
            $table->string('kind');
            $table->decimal('amount', 10, 2);
            $table->decimal('tendered', 10, 2)->nullable();
            $table->decimal('change', 10, 2)->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('order_payments');
        Schema::dropIfExists('order_line_addons');
        Schema::dropIfExists('order_lines');
        Schema::dropIfExists('orders');
    }
};
