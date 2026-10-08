<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations: the warehouse and commissary's stock, the commissary's products and batches,
     * transfers between locations (requisitions from the branches included), what each location
     * received, issues flagged on transfer lines, the shopping list and the suppliers.
     */
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('contact')->nullable();
            $table->string('phone')->nullable();
            $table->string('supplies')->nullable();
            $table->timestamps();
        });

        Schema::create('warehouse_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('on_hand', 12, 3)->default(0);
            $table->decimal('par', 12, 3)->default(0);
            $table->decimal('critical', 12, 3)->nullable();
            $table->timestamps();

            $table->unique(['branch_id', 'stock_item_id']);
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('servings_per_batch', 10, 2)->nullable();
            $table->string('serving_size')->nullable();
            $table->string('serving_unit')->nullable();
            $table->decimal('stock_per_batch', 12, 3)->nullable();
            $table->timestamps();
        });

        Schema::create('product_ingredients', function (Blueprint $table) {
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('qty', 12, 3);

            $table->primary(['product_id', 'stock_item_id']);
        });

        Schema::create('transfers', function (Blueprint $table) {
            $table->id();
            $table->string('kind');
            $table->foreignId('from_branch_id')->constrained('branches');
            $table->foreignId('to_branch_id')->constrained('branches');
            $table->string('status');
            $table->foreignId('requested_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('issued_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('issued_at')->nullable();
            $table->foreignId('closed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['from_branch_id', 'status']);
            $table->index(['to_branch_id', 'status']);
        });

        Schema::create('transfer_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained();
            $table->decimal('qty', 12, 3);
            $table->foreignId('received_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
        });

        Schema::create('production_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->decimal('batches', 8, 2);
            $table->string('status');
            $table->foreignId('transfer_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('logged_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('transfer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('source');
            $table->foreignId('received_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->foreignId('delivery_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->decimal('unit_cost', 10, 2)->nullable()->after('qty');
        });

        Schema::create('delivery_issues', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transfer_line_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('reason');
            $table->string('note', 300)->nullable();
            $table->foreignId('reported_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('shopping_list_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('stock_item_id')->nullable()->constrained()->nullOnDelete();
            $table->text('name');
            $table->string('unit');
            $table->decimal('cost', 10, 2)->default(0);
            $table->decimal('qty', 12, 3)->default(1);
            $table->boolean('ticked')->default(true);
            $table->string('reason')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shopping_list_lines');
        Schema::dropIfExists('delivery_issues');

        Schema::table('stock_receipts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('delivery_id');
            $table->dropColumn('unit_cost');
        });

        Schema::dropIfExists('deliveries');
        Schema::dropIfExists('production_batches');
        Schema::dropIfExists('transfer_lines');
        Schema::dropIfExists('transfers');
        Schema::dropIfExists('product_ingredients');
        Schema::dropIfExists('products');
        Schema::dropIfExists('warehouse_stock');
        Schema::dropIfExists('suppliers');
    }
};
