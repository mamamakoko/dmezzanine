<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations: bulk and event orders that marketing sends to a branch's till. They carry no
     * prices; the till prices them when the branch accepts, which creates the till order.
     */
    public function up(): void
    {
        Schema::create('marketing_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('agent_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('service');
            $table->string('customer');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->date('wanted_on');
            $table->string('wanted_at', 5)->nullable();
            $table->string('note')->nullable();
            $table->string('status')->default('sent');
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('replied_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reply')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamps();

            $table->index(['branch_id', 'status']);
        });

        Schema::create('marketing_order_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('marketing_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_item_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('qty');
            $table->json('addons');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('marketing_order_lines');
        Schema::dropIfExists('marketing_orders');
    }
};
