/**
 * Filter state lives in the URL.
 *
 * Not in a store, not in a context — in `?cat=Travel&st=SUCCESS&page=3`.
 * That decision buys three things for free: the back button steps through
 * filter changes, any view is shareable as a link, and a reload lands the
 * user exactly where they were. It also means there is only ever one copy
 * of this state, so the charts and the table cannot disagree.
 *
 * Param names are kept short so a filtered URL stays readable.
 */

import type { SortField, SortOrder, TransactionStatus, PaymentMethod } from "./types";

export interface FilterState {
  search: string;
  categories: string[];
  statuses: TransactionStatus[];
  methods: PaymentMethod[];
  months: string[];
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  flow: "" | "DEBIT" | "REFUND";
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export const DEFAULT_FILTERS: FilterState = {
  search: "",
  categories: [],
  statuses: [],
  methods: [],
  months: [],
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
  flow: "",
  sort: "occurred_at",
  order: "desc",
  page: 1,
  pageSize: 50,
};

const SORT_FIELDS: SortField[] = ["occurred_at", "amount", "merchant", "coins"];

export function parseFilters(params: URLSearchParams): FilterState {
  const sort = params.get("sort") as SortField | null;
  const order = params.get("order");
  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("size") ?? DEFAULT_FILTERS.pageSize);

  return {
    search: params.get("q") ?? "",
    categories: params.getAll("cat"),
    statuses: params.getAll("st") as TransactionStatus[],
    methods: params.getAll("pm") as PaymentMethod[],
    months: params.getAll("mo"),
    dateFrom: params.get("from") ?? "",
    dateTo: params.get("to") ?? "",
    minAmount: params.get("min") ?? "",
    maxAmount: params.get("max") ?? "",
    flow: (params.get("flow") as FilterState["flow"]) ?? "",
    sort: sort && SORT_FIELDS.includes(sort) ? sort : DEFAULT_FILTERS.sort,
    order: order === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [25, 50, 100].includes(pageSize) ? pageSize : DEFAULT_FILTERS.pageSize,
  };
}

/** Serialise back to the app's own URL. Defaults are omitted, so a clean
 *  view has a clean URL rather than a wall of redundant params. */
export function toUrlParams(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  state.categories.forEach((value) => params.append("cat", value));
  state.statuses.forEach((value) => params.append("st", value));
  state.methods.forEach((value) => params.append("pm", value));
  state.months.forEach((value) => params.append("mo", value));
  if (state.dateFrom) params.set("from", state.dateFrom);
  if (state.dateTo) params.set("to", state.dateTo);
  if (state.minAmount) params.set("min", state.minAmount);
  if (state.maxAmount) params.set("max", state.maxAmount);
  if (state.flow) params.set("flow", state.flow);
  if (state.sort !== DEFAULT_FILTERS.sort) params.set("sort", state.sort);
  if (state.order !== DEFAULT_FILTERS.order) params.set("order", state.order);
  if (state.page !== 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_FILTERS.pageSize) params.set("size", String(state.pageSize));
  return params;
}

/** Serialise to the API's param names. */
export function toApiParams(state: FilterState, options?: { paginated?: boolean }) {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("search", state.search.trim());
  state.categories.forEach((value) => params.append("category", value));
  state.statuses.forEach((value) => params.append("status", value));
  state.methods.forEach((value) => params.append("method", value));
  state.months.forEach((value) => params.append("month", value));
  if (state.dateFrom) params.set("date_from", state.dateFrom);
  if (state.dateTo) params.set("date_to", state.dateTo);
  if (state.minAmount) params.set("min_amount", state.minAmount);
  if (state.maxAmount) params.set("max_amount", state.maxAmount);
  if (state.flow) params.set("flow", state.flow);

  if (options?.paginated !== false) {
    params.set("page", String(state.page));
    params.set("page_size", String(state.pageSize));
    params.set("sort", state.sort);
    params.set("order", state.order);
  }
  return params;
}

/** One chip per active filter, for the removable filter bar. */
export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
  clear: (state: FilterState) => FilterState;
}

export function activeChips(state: FilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.search) {
    chips.push({
      key: "search",
      label: "Search",
      value: `"${state.search}"`,
      clear: (s) => ({ ...s, search: "" }),
    });
  }

  state.categories.forEach((category) =>
    chips.push({
      key: `cat:${category}`,
      label: "Category",
      value: category,
      clear: (s) => ({ ...s, categories: s.categories.filter((c) => c !== category) }),
    }),
  );

  state.statuses.forEach((status) =>
    chips.push({
      key: `st:${status}`,
      label: "Status",
      value: status,
      clear: (s) => ({ ...s, statuses: s.statuses.filter((v) => v !== status) }),
    }),
  );

  state.methods.forEach((method) =>
    chips.push({
      key: `pm:${method}`,
      label: "Method",
      value: method.replace("_", " "),
      clear: (s) => ({ ...s, methods: s.methods.filter((v) => v !== method) }),
    }),
  );

  state.months.forEach((month) =>
    chips.push({
      key: `mo:${month}`,
      label: "Month",
      value: month,
      clear: (s) => ({ ...s, months: s.months.filter((v) => v !== month) }),
    }),
  );

  if (state.dateFrom || state.dateTo) {
    chips.push({
      key: "dates",
      label: "Dates",
      value: `${state.dateFrom || "start"} → ${state.dateTo || "today"}`,
      clear: (s) => ({ ...s, dateFrom: "", dateTo: "" }),
    });
  }

  if (state.minAmount || state.maxAmount) {
    chips.push({
      key: "amount",
      label: "Amount",
      value: `₹${state.minAmount || "0"} – ₹${state.maxAmount || "∞"}`,
      clear: (s) => ({ ...s, minAmount: "", maxAmount: "" }),
    });
  }

  if (state.flow) {
    chips.push({
      key: "flow",
      label: "Type",
      value: state.flow === "REFUND" ? "Refunds" : "Payments",
      clear: (s) => ({ ...s, flow: "" }),
    });
  }

  return chips;
}

export function hasActiveFilters(state: FilterState): boolean {
  return activeChips(state).length > 0;
}

/** Toggle a value in one of the multi-select filters. */
export function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
