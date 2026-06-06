/**
 * Pure game logic for Matching Mode, extracted from MatchingMessage so it can be
 * unit-tested without rendering React. The component owns only the interaction
 * state (selection, matched set, wrong-flash timer) and delegates the shuffle and
 * scoring to these helpers.
 */
import type { Matching } from "@/lib/matching";

/** One right-column entry: its display text plus the pair index it belongs to. */
export interface ShuffledRight {
  text: string;
  pairIndex: number;
}

/**
 * Fisher-Yates shuffle of the right column. The left column stays in pair order;
 * shuffling the right side is what makes the game non-trivial. Each entry keeps
 * its original `pairIndex` so a match is "right.pairIndex === selected left index".
 */
export function shuffleRight(pairs: Matching["pairs"]): ShuffledRight[] {
  const arr: ShuffledRight[] = pairs.map((p, i) => ({
    text: p.right,
    pairIndex: i,
  }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * First-try accuracy as a whole percent: pairs solved over attempts made. A
 * perfect run (one attempt per pair) is 100%; every wrong click lowers it.
 * Guards the zero-attempt case (finished with no clicks logged) to 100.
 */
export function computeAccuracy(totalPairs: number, attempts: number): number {
  if (attempts <= 0) return 100;
  return Math.round((totalPairs / attempts) * 100);
}
