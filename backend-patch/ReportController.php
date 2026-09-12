<?php

namespace App\Http\Controllers\Application;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Listing reports (Trust & Safety).
 *
 * The platform has no reporting anywhere today — not in the mobile app, not in
 * the API — so the web client can only offer a "open your email app" fallback.
 * This gives both clients a real endpoint: authenticated, rate limited, and
 * recorded rather than sent into a shared inbox by the user's mail client.
 *
 * Route (inside the `jwt.auth` group in routes/api.php):
 *   Route::post('/reports', [ReportController::class, 'store']);
 *
 * Requires the migration in `create_reports_table.php`.
 */
class ReportController extends Controller
{
    /** Reasons the clients may submit. Keep in step with the web client. */
    private const REASONS = ['spam', 'prohibited', 'fraud', 'offensive', 'other'];

    private const MAX_PER_HOUR = 10;

    public function store(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth('api')->user();

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $validator = Validator::make($request->all(), [
            'productID' => 'required|exists:products,id',
            'reason' => 'required|string|in:' . implode(',', self::REASONS),
            'details' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        // Rate limit per reporter, so one account cannot flood moderation.
        $throttleKey = 'reports:' . $user->id;
        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_PER_HOUR)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many reports. Please try again later.',
            ], 429);
        }

        try {
            $product = Product::query()->find($request->input('productID'));

            // One report per user per listing — re-reporting is a no-op that
            // still answers success, so the client UX stays simple.
            $existing = \DB::table('reports')
                ->where('productID', $product->id)
                ->where('reportedBy', $user->id)
                ->exists();

            if (!$existing) {
                RateLimiter::hit($throttleKey, 3600);

                \DB::table('reports')->insert([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'productID' => $product->id,
                    'reportedBy' => $user->id,
                    'reason' => $request->input('reason'),
                    'details' => $request->input('details'),
                    'status' => 0, // 0 = open, 1 = reviewed, 2 = actioned
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                $this->notifyModerators($product, $user, $request->input('reason'));
            }

            return response()->json([
                'success' => true,
                'message' => 'Thank you. Our team will review this listing.',
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to store listing report.', [
                'user_id' => $user->id,
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to submit the report right now.',
            ], 500);
        }
    }

    /**
     * Notifies moderation. The destination lives in config, never in client
     * code, so the moderation inbox is not shipped to browsers.
     */
    private function notifyModerators(Product $product, $reporter, string $reason): void
    {
        $moderationAddress = config('mail.moderation_address');
        if (!$moderationAddress) {
            return;
        }

        try {
            Mail::raw(
                "Listing reported\n\n"
                . "Listing: {$product->id} — {$product->name}\n"
                . "Reason: {$reason}\n"
                . "Reported by: {$reporter->id}\n",
                fn ($message) => $message->to($moderationAddress)->subject('Souqna: listing reported')
            );
        } catch (Throwable $e) {
            // The report is already persisted; email is best-effort.
            Log::warning('Moderation email failed.', ['exception' => $e]);
        }
    }
}
