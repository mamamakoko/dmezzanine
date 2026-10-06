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
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('kind');
            $table->boolean('split')->default(false);
            $table->text('note')->nullable();
            $table->string('terminal')->nullable();
            $table->string('wallets')->nullable();
            $table->decimal('tab_limit', 10, 2)->nullable();
            $table->boolean('lead_only')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'name']);
        });

        Schema::create('payment_method_log', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['branch_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_method_log');
        Schema::dropIfExists('payment_methods');
    }
};
