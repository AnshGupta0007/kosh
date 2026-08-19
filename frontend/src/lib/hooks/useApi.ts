"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { ApiError, api } from "@/lib/api";
import { type FilterState, toApiParams } from "@/lib/filters";
import type { Balance, RedeemResponse, Reward } from "@/lib/types";

// Registers ApiError as the error type for every query and mutation in the
// app, so callers can branch on `error.code` without casting at each site.
declare module "@tanstack/react-query" {
  interface Register {
    defaultError: ApiError;
  }
}

export const queryKeys = {
  transactions: (params: string) => ["transactions", params] as const,
  transaction: (id: number) => ["transaction", id] as const,
  options: ["filter-options"] as const,
  analytics: (params: string) => ["analytics", params] as const,
  balance: ["balance"] as const,
  rewards: ["rewards"] as const,
  redemptions: ["redemptions"] as const,
  dataQuality: ["data-quality"] as const,
  me: ["me"] as const,
};

export function useTransactions(filters: FilterState) {
  const params = toApiParams(filters);
  return useQuery({
    queryKey: queryKeys.transactions(params.toString()),
    queryFn: () => api.transactions(params),
    // The previous page stays on screen while the next one loads, so paging
    // and sorting never flash an empty table.
    placeholderData: keepPreviousData,
  });
}

export function useTransaction(id: number | null) {
  return useQuery({
    queryKey: queryKeys.transaction(id ?? 0),
    queryFn: () => api.transaction(id as number),
    enabled: id !== null,
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: queryKeys.options,
    queryFn: api.filterOptions,
    staleTime: Infinity, // reference data; it does not change while you browse
  });
}

export function useAnalytics(filters: FilterState) {
  // Analytics ignores pagination and sorting: the charts describe the whole
  // filtered set, not the page you happen to be looking at.
  const params = toApiParams(filters, { paginated: false });
  return useQuery({
    queryKey: queryKeys.analytics(params.toString()),
    queryFn: () => api.analytics(params),
    placeholderData: keepPreviousData,
  });
}

export function useBalance() {
  return useQuery({ queryKey: queryKeys.balance, queryFn: api.balance });
}

export function useRewards() {
  return useQuery({ queryKey: queryKeys.rewards, queryFn: api.rewards });
}

export function useRedemptions() {
  return useQuery({ queryKey: queryKeys.redemptions, queryFn: api.redemptions });
}

export function useDataQuality() {
  return useQuery({
    queryKey: queryKeys.dataQuality,
    queryFn: api.dataQuality,
    staleTime: Infinity,
  });
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: api.me, staleTime: Infinity });
}

/**
 * Redeem, optimistically.
 *
 * The balance drops the instant the user confirms, because a reward
 * redemption should feel immediate. If the call fails, the snapshot taken in
 * `onMutate` is put back — the balance is never left guessing. The server's
 * authoritative balance replaces the optimistic one on success, so the two
 * can never drift.
 */
export function useRedeem() {
  const queryClient = useQueryClient();

  return useMutation<
    RedeemResponse,
    ApiError,
    { reward: Reward; idempotencyKey: string },
    { previousBalance?: Balance; previousRewards?: Reward[] }
  >({
    mutationFn: ({ reward, idempotencyKey }) => api.redeem(reward.slug, idempotencyKey),

    onMutate: async ({ reward }) => {
      // Stop any in-flight refetch from overwriting the optimistic value.
      await queryClient.cancelQueries({ queryKey: queryKeys.balance });
      await queryClient.cancelQueries({ queryKey: queryKeys.rewards });

      const previousBalance = queryClient.getQueryData<Balance>(queryKeys.balance);
      const previousRewards = queryClient.getQueryData<Reward[]>(queryKeys.rewards);

      if (previousBalance) {
        const optimistic: Balance = {
          ...previousBalance,
          balance: previousBalance.balance - reward.coin_cost,
          lifetime_redeemed: previousBalance.lifetime_redeemed + reward.coin_cost,
        };
        queryClient.setQueryData(queryKeys.balance, optimistic);

        // Affordability is derived from the balance, so the catalogue has to
        // move with it or a card would claim you can afford what you cannot.
        if (previousRewards) {
          queryClient.setQueryData<Reward[]>(
            queryKeys.rewards,
            previousRewards.map((item) => ({
              ...item,
              affordable: optimistic.balance >= item.coin_cost && item.stock !== 0,
              coins_short: Math.max(0, item.coin_cost - optimistic.balance),
            })),
          );
        }
      }

      return { previousBalance, previousRewards };
    },

    onError: (_error, _variables, context) => {
      if (context?.previousBalance) {
        queryClient.setQueryData(queryKeys.balance, context.previousBalance);
      }
      if (context?.previousRewards) {
        queryClient.setQueryData(queryKeys.rewards, context.previousRewards);
      }
    },

    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.balance, data.balance);
    },

    onSettled: () => {
      // Whatever happened, re-sync with the server.
      void queryClient.invalidateQueries({ queryKey: queryKeys.balance });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewards });
      void queryClient.invalidateQueries({ queryKey: queryKeys.redemptions });
    },
  });
}
