<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Issues a Firebase custom token for the currently authenticated Souqna user.
 *
 * This is the bridge between the two identity systems: the caller proves who
 * they are with their Laravel JWT, and receives a short-lived Firebase token
 * whose `uid` is their existing Souqna user UUID. Firestore rules can then
 * check `request.auth.uid` against the `members` array on a conversation.
 *
 * The uid MUST stay the Souqna user id — the conversation documents already
 * store those ids, so changing it would orphan every existing chat.
 *
 * Route (inside the `jwt.auth` group in routes/api.php):
 *   Route::post('/firebase-token', [FirebaseTokenController::class, 'issue']);
 *
 * Requires a service account key for the souqnaapp-2c1da project; see
 * FIRESTORE_SECURITY.md. `firebase/php-jwt` is already a dependency.
 */
class FirebaseTokenController extends Controller
{
    private const TOKEN_LIFETIME_SECONDS = 3600;
    private const AUDIENCE = 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

    public function issue(Request $request): JsonResponse
    {
        $user = $request->user() ?: auth('api')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        $credentialsPath = config('services.firebase.credentials')
            ?: storage_path('app/firebase/souqna-admin.json');

        if (!is_readable($credentialsPath)) {
            Log::error('Firebase credentials file missing.', ['path' => $credentialsPath]);

            return response()->json([
                'success' => false,
                'message' => 'Chat is temporarily unavailable.',
            ], 503);
        }

        try {
            $credentials = json_decode((string) file_get_contents($credentialsPath), true, 512, JSON_THROW_ON_ERROR);

            $serviceAccountEmail = $credentials['client_email'] ?? null;
            $privateKey = $credentials['private_key'] ?? null;

            if (!$serviceAccountEmail || !$privateKey) {
                throw new \RuntimeException('Service account file is missing client_email or private_key.');
            }

            $issuedAt = time();

            $token = JWT::encode(
                [
                    'iss' => $serviceAccountEmail,
                    'sub' => $serviceAccountEmail,
                    'aud' => self::AUDIENCE,
                    'iat' => $issuedAt,
                    'exp' => $issuedAt + self::TOKEN_LIFETIME_SECONDS,
                    // The Souqna user UUID becomes the Firebase uid.
                    'uid' => (string) $user->id,
                    // Optional extras readable from rules as request.auth.token.*
                    'claims' => [
                        'role' => (int) $user->role,
                    ],
                ],
                $privateKey,
                'RS256'
            );

            return response()->json([
                'success' => true,
                'data' => [
                    'token' => $token,
                    'expiresIn' => self::TOKEN_LIFETIME_SECONDS,
                ],
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to mint Firebase custom token.', [
                'user_id' => $user->id,
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Chat is temporarily unavailable.',
            ], 500);
        }
    }
}
