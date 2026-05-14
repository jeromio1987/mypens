export interface StaticMacroEvent {
  date: string
  title: string
  kind: string
}

export function getStaticMacroEventsInRange(
  _from: string,
  _to: string,
): StaticMacroEvent[] {
  return []
}
