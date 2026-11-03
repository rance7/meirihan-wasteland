// Work with date-only strings in UTC so calendar dates never shift with the browser timezone.
export function shiftMonth(month, amount) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}

export function monthDays(month) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({length: 42}, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {key, day: date.getUTCDate(), inMonth: key.startsWith(month)};
  });
}

export function groupByPublicationDate(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.date)) groups.set(record.date, []);
    groups.get(record.date).push(record);
  }
  return groups;
}
