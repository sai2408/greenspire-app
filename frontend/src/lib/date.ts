// Local calendar date as YYYY-MM-DD. Never use `date.toISOString().slice(0, 10)`
// for this — it reports the UTC calendar day, which is a different date than the
// device's local day for roughly a third of each day outside UTC+0.
export const toLocalYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
