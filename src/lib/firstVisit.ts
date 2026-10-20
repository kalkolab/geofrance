// Only the first visit to each commune is kept: the earliest dated one, or when no visit
// has a date, the one recorded first. Ties go to the smallest uid so every device agrees.

interface Dated {
  uid?: string
  date: string | null
  createdAt: string
}

export function isEarlier(a: Dated, b: Dated): boolean {
  if (a.date !== b.date) return a.date !== null && (b.date === null || a.date < b.date)
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt
  return (a.uid ?? '') < (b.uid ?? '')
}

// Splits visits into the first one per commune and the rest.
export function firstVisits<T extends Dated & { commune: string }>(visits: T[]): { first: Map<string, T>; extra: T[] } {
  const first = new Map<string, T>()
  const extra: T[] = []
  for (const v of visits) {
    const current = first.get(v.commune)
    if (!current) first.set(v.commune, v)
    else if (isEarlier(v, current)) {
      extra.push(current)
      first.set(v.commune, v)
    } else extra.push(v)
  }
  return { first, extra }
}
