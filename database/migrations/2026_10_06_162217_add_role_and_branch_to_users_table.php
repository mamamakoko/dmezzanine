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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('role_id')->after('id')->constrained();
            $table->foreignId('branch_id')->nullable()->after('role_id')->constrained()->nullOnDelete();
            $table->string('pin_hash')->nullable()->after('password');
            $table->boolean('active')->default(true)->after('pin_hash');
            $table->string('google_id')->nullable()->unique()->after('active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('role_id');
            $table->dropConstrainedForeignId('branch_id');
            $table->dropUnique(['google_id']);
            $table->dropColumn(['pin_hash', 'active', 'google_id']);
        });
    }
};
