<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Listing reports. Place in database/migrations/ with a timestamped filename,
 * e.g. 2026_09_12_000000_create_reports_table.php
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('productID');
            $table->uuid('reportedBy');
            $table->string('reason', 32);
            $table->text('details')->nullable();
            $table->unsignedTinyInteger('status')->default(0);
            $table->timestamps();

            $table->foreign('productID')->references('id')->on('products')->cascadeOnDelete();
            $table->foreign('reportedBy')->references('id')->on('users')->cascadeOnDelete();

            // One report per user per listing, and a fast moderation queue.
            $table->unique(['productID', 'reportedBy']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
