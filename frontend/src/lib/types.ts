/**
 * Mirrors the FastAPI response models.
 *
 * Hand-written rather than generated: the surface is small, and the exact
 * unions (`"SUCCESS" | "PENDING" | "FAILED"`) are what let the table,
 * filters and badges typecheck against each other.
 *
 * Money crosses the wire as integer paise and is only ever formatted at the
 * edge — no float arithmetic anywhere in the client.
 */

export type TransactionStatus = "SUCCESS" | "PENDING" | "FAILED";
export type PaymentMethod = "UPI" | "CREDIT_CARD" | "DEBIT_CARD" | "NETBANKING";
export type TransactionFlow = "DEBIT" | "REFUND";
export type SortField = "occurred_at" | "amount" | "merchant" | "coins";
export type SortOrder = "asc" | "desc";

export interface Transaction {
  id: number;
  external_id: string;
  occurred_at: string;
  merchant: string;
  category: string | null;
  amount_paise: number;
  currency: string;
  status: TransactionStatus;
  method: PaymentMethod;
  flow: TransactionFlow;
  coins_earned: number;
  quality_flags: string[];
  is_quarantined: boolean;
}

export interface TransactionDetail extends Transaction {
  source_row: Record<string, unknown>;
  merchant_category: string | null;
}

export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface TransactionPage {
  items: Transaction[];
  meta: PageMeta;
  filtered_total_paise: number;
  filtered_refund_paise: number;
  query_ms: number;
}

export interface FilterOptions {
  categories: string[];
  merchants: string[];
  statuses: TransactionStatus[];
  methods: PaymentMethod[];
  min_amount_paise: number;
  max_amount_paise: number;
  earliest: string | null;
  latest: string | null;
}

export interface CategorySlice {
  category: string;
  slug: string;
  hue: number;
  total_paise: number;
  transaction_count: number;
  share: number;
}

export interface MonthPoint {
  month: string;
  label: string;
  total_paise: number;
  refund_paise: number;
  transaction_count: number;
  coins_earned: number;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD, IST calendar day
  total_paise: number;
  transaction_count: number;
}

export interface NamedSlice {
  name: string;
  total_paise: number;
  transaction_count: number;
}

export interface Kpis {
  total_spend_paise: number;
  total_refund_paise: number;
  net_paise: number;
  transaction_count: number;
  average_paise: number;
  largest_paise: number;
  success_rate: number;
  failed_count: number;
  pending_count: number;
  coins_earned: number;
  distinct_merchants: number;
}

export interface Analytics {
  kpis: Kpis;
  by_category: CategorySlice[];
  by_month: MonthPoint[];
  by_day: DayPoint[];
  by_method: NamedSlice[];
  top_merchants: NamedSlice[];
  query_ms: number;
}

export interface Balance {
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
  coin_value_paise: number;
  earning_transactions: number;
}

export interface Reward {
  id: number;
  slug: string;
  title: string;
  description: string;
  kind: "VOUCHER" | "CASHBACK" | "DONATION" | "UPGRADE";
  coin_cost: number;
  value_paise: number;
  stock: number | null;
  icon: string;
  accent: string;
  affordable: boolean;
  coins_short: number;
}

export interface Redemption {
  id: string;
  reward_slug: string;
  reward_title: string;
  reward_icon: string;
  coin_cost: number;
  value_paise: number;
  voucher_code: string;
  status: "CONFIRMED" | "REVERSED";
  created_at: string;
}

export interface RedeemResponse {
  redemption: Redemption;
  balance: Balance;
  replayed: boolean;
}

export interface QualityIssue {
  code: string;
  label: string;
  detail: string;
  resolution: string;
  severity: "INFO" | "REPAIRED" | "QUARANTINED";
  row_count: number;
  samples: Record<string, unknown>[];
}

export interface IngestionReport {
  source_file: string;
  finished_at: string | null;
  rows_in: number;
  rows_loaded: number;
  rows_repaired: number;
  rows_quarantined: number;
  duration_ms: number | null;
  issues: QualityIssue[];
}

export interface CurrentUser {
  display_name: string;
  email: string;
  card_last4: string;
  coin_rule: {
    rupees_per_coin: number;
    cap_per_transaction: number;
    coin_value_paise: number;
  };
}
