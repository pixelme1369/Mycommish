/**
 * Normalize US-style agent mobiles for storage.
 * Keeps digits; formats as +1XXXXXXXXXX when 10/11 digits look US.
 * Returns null for empty; throws Error for invalid.
 */
export function normalizeAgentPhone(raw: string): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  // Allow E.164-ish international (8–15 digits) if user typed +country…
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new Error("Enter a valid mobile number (10-digit US or +country code).");
}

export function formatPhoneForDisplay(stored: string | null | undefined): string {
  if (!stored) return "";
  const digits = stored.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const n = digits.slice(1);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return stored;
}
