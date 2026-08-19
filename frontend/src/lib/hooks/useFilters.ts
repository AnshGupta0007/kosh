"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { DEFAULT_FILTERS, type FilterState, parseFilters, toUrlParams } from "@/lib/filters";

/**
 * Read and write the filter state that lives in the URL.
 *
 * Every mutation resets `page` to 1 unless it *is* a page change — changing
 * a filter while sitting on page 7 of the old result set is never what the
 * user meant.
 */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const write = useCallback(
    (next: FilterState) => {
      const query = toUrlParams(next).toString();
      // replace, not push: typing in the search box should not bury the
      // back button under one history entry per keystroke.
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      const isPageChange = "page" in patch;
      write({ ...filters, ...patch, page: isPageChange ? (patch.page ?? 1) : 1 });
    },
    [filters, write],
  );

  const reset = useCallback(() => write(DEFAULT_FILTERS), [write]);

  const apply = useCallback(
    (mutate: (state: FilterState) => FilterState) => {
      write({ ...mutate(filters), page: 1 });
    },
    [filters, write],
  );

  return { filters, update, apply, reset };
}
