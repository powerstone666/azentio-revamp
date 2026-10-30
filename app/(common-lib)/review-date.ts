const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A review date must be a real calendar date (YYYY-MM-DD), today or later, and within two years. */
export function validReviewDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return date.getTime() >= today && date.getTime() <= today + 730 * 86_400_000;
}
