export const SIGNED_DOC_VISIBLE_MONTHS = 4;

export function signedDocVisibleUntil(signedAt: Date): Date {
  const until = new Date(signedAt);
  until.setMonth(until.getMonth() + SIGNED_DOC_VISIBLE_MONTHS);
  return until;
}

export function isSignedDocStillVisible(signedAt: Date, now = new Date()): boolean {
  return signedDocVisibleUntil(signedAt) >= now;
}
