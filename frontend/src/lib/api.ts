/**
 * The one place that talks to the API.
 *
 * Every failure becomes an `ApiError` carrying the backend's machine-readable
 * `code`, so the UI can branch on `INSUFFICIENT_COINS` instead of pattern
 * matching on a message string.
 */

import type {
  Analytics,
  Balance,
  CurrentUser,
  FilterOptions,
  IngestionReport,
  RedeemResponse,
  Redemption,
  Reward,
  TransactionDetail,
  TransactionPage,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly detail: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    // A network-level failure has no HTTP status; it still needs a code the
    // UI can show a sensible message for.
    throw new ApiError("NETWORK_ERROR", "Could not reach the Kosh API.", 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      detail?: unknown;
    };
    throw new ApiError(
      body.code ?? "HTTP_ERROR",
      body.message ?? `Request failed with status ${response.status}.`,
      response.status,
      (typeof body.detail === "object" && body.detail !== null
        ? (body.detail as Record<string, unknown>)
        : {}),
    );
  }

  return (await response.json()) as T;
}

export const api = {
  transactions: (params: URLSearchParams) =>
    request<TransactionPage>(`/api/transactions?${params}`),

  transaction: (id: number) => request<TransactionDetail>(`/api/transactions/${id}`),

  filterOptions: () => request<FilterOptions>("/api/transactions/options"),

  analytics: (params: URLSearchParams) => request<Analytics>(`/api/analytics?${params}`),

  balance: () => request<Balance>("/api/wallet/balance"),

  rewards: () => request<Reward[]>("/api/rewards"),

  redemptions: () => request<Redemption[]>("/api/rewards/redemptions"),

  redeem: (rewardSlug: string, idempotencyKey: string) =>
    request<RedeemResponse>("/api/rewards/redeem", {
      method: "POST",
      body: JSON.stringify({ reward_slug: rewardSlug, idempotency_key: idempotencyKey }),
    }),

  dataQuality: () => request<IngestionReport>("/api/data-quality"),

  me: () => request<CurrentUser>("/api/me"),
};
