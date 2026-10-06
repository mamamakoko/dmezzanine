<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. A refund is a negative order tied to the original sale (refund_of), with a
     * reason and the manager who approved it. Each refund line points at the line it gives back, and a
     * refund has no ticket.
     */
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedTinyInteger('ticket')->nullable()->change();
            $table->foreignId('refund_of')->nullable()->after('note')->constrained('orders')->nullOnDelete();
            $table->string('refund_reason')->nullable()->after('refund_of');
            $table->foreignId('approved_by_id')->nullable()->after('refund_reason')->constrained('users')->nullOnDelete();
        });

        Schema::table('order_lines', function (Blueprint $table) {
            $table->foreignId('refund_of_line_id')->nullable()->after('order_id')->constrained('order_lines')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('order_lines', function (Blueprint $table) {
            $table->dropConstrainedForeignId('refund_of_line_id');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('approved_by_id');
            $table->dropConstrainedForeignId('refund_of');
            $table->dropColumn('refund_reason');
            $table->unsignedTinyInteger('ticket')->nullable(false)->change();
        });
    }
};
