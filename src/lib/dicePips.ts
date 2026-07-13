// Augen-Positionen (Spalte, Zeile) im 3×3-Raster.
// Bewusst außerhalb der Physik-Komponente: kleine Würfel können dieses Mapping
// nutzen, ohne dadurch cannon-es und die komplette DiceArena ins Startbundle zu ziehen.
export const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}
