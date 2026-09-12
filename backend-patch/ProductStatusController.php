<?php

namespace App\Http\Controllers\Application\Product;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Throwable;

/**
 * Seller-controlled listing lifecycle: pause a listing or mark it as sold.
 *
 * Added for feature parity between the Souqna web app and the mobile app.
 * Both clients call the same endpoint; the mobile app is unaffected until it
 * chooses to use it.
 *
 * Status values:
 *   0 created (publicly listed, not explicitly approved)
 *   1 approved by an admin (publicly listed)
 *   2 paused by the seller
 *   3 sold
 *
 * Ownership is verified server-side against the JWT subject — the product id
 * from the request is never trusted on its own.
 */
class ProductStatusController extends Controller
{
    /** Statuses a seller is allowed to set on their own listing. */
    private const SELLER_SETTABLE = [1, 2, 3];

    public function update(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|exists:products,id',
            'status' => 'required|integer|in:1,2,3',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => $validator->errors()->first(),
            ], 422);
        }

        $user = auth('api')->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $product = Product::query()->find($request->input('id'));
        if (!$product) {
            return response()->json(['success' => false, 'message' => 'Product not found'], 404);
        }

        if ((string) $product->userID !== (string) $user->id && (int) $user->role !== 1) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized: you cannot change this product',
            ], 403);
        }

        $status = (int) $request->input('status');
        if (!in_array($status, self::SELLER_SETTABLE, true)) {
            return response()->json(['success' => false, 'message' => 'Invalid status'], 422);
        }

        try {
            $product->status = $status;
            $product->save();

            return response()->json([
                'success' => true,
                'message' => 'Listing status updated',
                'data' => ['id' => $product->id, 'status' => $product->status],
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to update listing status.', [
                'product_id' => $product->id,
                'user_id' => $user->id,
                'exception' => $e,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to update the listing status right now.',
            ], 500);
        }
    }
}
