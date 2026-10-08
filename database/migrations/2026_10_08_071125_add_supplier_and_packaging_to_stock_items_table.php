<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations: who supplies each item, and how it is packed when it is bought (a case of 6 L).
     */
    public function up(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('par')->constrained()->nullOnDelete();
            $table->string('pack_name')->nullable()->after('supplier_id');
            $table->decimal('pack_size', 10, 3)->nullable()->after('pack_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn(['pack_name', 'pack_size']);
        });
    }
};
