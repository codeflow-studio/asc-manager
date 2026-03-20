export const MOBILE_BREAKPOINT = 768;

export const STATUS_MAP = {
  PREPARE_FOR_SUBMISSION: { label: "Prepare for Submission", color: "#ff9500", bg: "rgba(255,149,0,0.12)" },
  WAITING_FOR_REVIEW: { label: "Waiting for Review", color: "#ff9500", bg: "rgba(255,149,0,0.12)" },
  IN_REVIEW: { label: "In Review", color: "#af52de", bg: "rgba(175,82,222,0.12)" },
  READY_FOR_DISTRIBUTION: { label: "Ready for Distribution", color: "#34c759", bg: "rgba(52,199,89,0.12)" },
  READY_FOR_SALE: { label: "Ready for Sale", color: "#34c759", bg: "rgba(52,199,89,0.12)" },
  DEVELOPER_REJECTED: { label: "Developer Rejected", color: "#ff3b30", bg: "rgba(255,59,48,0.12)" },
  REJECTED: { label: "Rejected", color: "#ff3b30", bg: "rgba(255,59,48,0.12)" },
  PENDING_DEVELOPER_RELEASE: { label: "Pending Release", color: "#007aff", bg: "rgba(0,122,255,0.12)" },
  REMOVED_FROM_SALE: { label: "Removed", color: "#8e8e93", bg: "rgba(142,142,147,0.12)" },
};

export const TERMINAL_STATES = new Set([
  "READY_FOR_SALE",
  "REMOVED_FROM_SALE",
  "DEVELOPER_REJECTED",
  "REJECTED",
]);

export const ACCT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a78bfa", "#ef4444", "#ec4899", "#14b8a6"];

export const IAP_STATUS_MAP = {
  MISSING_METADATA: { label: "Missing Metadata", color: "#ff9500", bg: "rgba(255,149,0,0.12)" },
  READY_TO_SUBMIT: { label: "Ready to Submit", color: "#007aff", bg: "rgba(0,122,255,0.12)" },
  WAITING_FOR_REVIEW: { label: "Waiting for Review", color: "#ff9500", bg: "rgba(255,149,0,0.12)" },
  IN_REVIEW: { label: "In Review", color: "#af52de", bg: "rgba(175,82,222,0.12)" },
  APPROVED: { label: "Approved", color: "#34c759", bg: "rgba(52,199,89,0.12)" },
  DEVELOPER_ACTION_NEEDED: { label: "Action Needed", color: "#ff3b30", bg: "rgba(255,59,48,0.12)" },
  REJECTED: { label: "Rejected", color: "#ff3b30", bg: "rgba(255,59,48,0.12)" },
  REMOVED_FROM_SALE: { label: "Removed", color: "#8e8e93", bg: "rgba(142,142,147,0.12)" },
};

export const IAP_TYPES = [
  { value: "CONSUMABLE", label: "Consumable" },
  { value: "NON_CONSUMABLE", label: "Non-Consumable" },
  { value: "NON_RENEWING_SUBSCRIPTION", label: "Non-Renewing Subscription" },
];

export const SUBSCRIPTION_PERIODS = [
  { value: "ONE_WEEK", label: "1 Week" },
  { value: "ONE_MONTH", label: "1 Month" },
  { value: "TWO_MONTHS", label: "2 Months" },
  { value: "THREE_MONTHS", label: "3 Months" },
  { value: "SIX_MONTHS", label: "6 Months" },
  { value: "ONE_YEAR", label: "1 Year" },
];
