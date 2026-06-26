// Feste, gut unterscheidbare Spielerfarben für den Dunkel-Look. Die Farbe wird
// deterministisch aus dem Namen abgeleitet – so hat jedes Clique-Mitglied immer
// dieselbe Farbe, ganz ohne sie speichern zu müssen.
const PALETTE = [
  '#f5b83d', // gold
  '#2fd3a5', // mint
  '#7c8bff', // iris
  '#fb5e73', // koralle
  '#38bdf8', // himmelblau
  '#c084fc', // violett
  '#a3e635', // limette
  '#fb923c', // orange
  '#2dd4bf', // teal
  '#f472b6', // pink
]

export function playerColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
