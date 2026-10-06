<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations. Order numbers share one sequence across every till at a branch.
     */
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->unsignedInteger('last_order_no')->default(0)->after('lng');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn('last_order_no');
        });
    }
};
