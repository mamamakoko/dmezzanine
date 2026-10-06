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
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->unique(['branch_id', 'name']);
        });

        Schema::create('menu_items', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('price', 10, 2);
            $table->string('note')->nullable();
            $table->boolean('has_modifiers')->default(false);
            $table->string('photo_path')->nullable();
            $table->timestamps();
        });

        Schema::create('branch_menu_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('menu_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained();
            $table->boolean('available')->default(true);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->timestamps();

            $table->unique(['branch_id', 'menu_item_id']);
        });

        Schema::create('recipes', function (Blueprint $table) {
            $table->foreignId('menu_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stock_item_id')->constrained()->cascadeOnDelete();
            $table->decimal('qty', 10, 3);

            $table->primary(['menu_item_id', 'stock_item_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recipes');
        Schema::dropIfExists('branch_menu_items');
        Schema::dropIfExists('menu_items');
        Schema::dropIfExists('categories');
    }
};
