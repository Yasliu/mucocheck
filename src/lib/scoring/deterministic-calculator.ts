import { GradeBand } from "../types";

export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { grade: "A*", min_pct: 90, max_pct: 100, descriptor: "Outstanding" },
  { grade: "A", min_pct: 80, max_pct: 89.99, descriptor: "Excellent" },
  { grade: "B", min_pct: 70, max_pct: 79.99, descriptor: "Very Good" },
  { grade: "C", min_pct: 60, max_pct: 69.99, descriptor: "Good" },
  { grade: "D", min_pct: 50, max_pct: 59.99, descriptor: "Satisfactory" },
  { grade: "E", min_pct: 40, max_pct: 49.99, descriptor: "Marginal" },
  { grade: "F", min_pct: 0, max_pct: 39.99, descriptor: "Unsatisfactory" },
];

export type RoundingMode = "half_up" | "floor" | "ceil";

/**
 * Deterministic rounding following configured policy
 */
export function roundScore(value: number, mode: RoundingMode = "half_up", precision: number = 1): number {
  const factor = Math.pow(10, precision);
  if (mode === "floor") {
    return Math.floor(value * factor) / factor;
  }
  if (mode === "ceil") {
    return Math.ceil(value * factor) / factor;
  }
  // Standard half-up
  return Math.round(value * factor) / factor;
}

/**
 * Validates that a proposed or approved score strictly falls within [0, max_marks]
 */
export function validateScoreBounds(
  score: number | null | undefined,
  maxMarks: number
): { valid: boolean; error?: string } {
  if (score === null || score === undefined) {
    return { valid: true }; // null indicates unsubmitted / missing
  }

  if (typeof score !== "number" || Number.isNaN(score)) {
    return { valid: false, error: "Score must be a valid numeric value" };
  }

  if (score < 0) {
    return { valid: false, error: `Score (${score}) cannot be negative` };
  }

  if (score > maxMarks) {
    return { valid: false, error: `Score (${score}) cannot exceed maximum marks (${maxMarks})` };
  }

  return { valid: true };
}

/**
 * Calculates raw total, percentage and converted mark deterministically.
 * Does NOT treat missing/null question marks as 0 without explicit indication.
 */
export function calculateStudentTotals(
  scores: Array<{ score: number | null; max: number }>,
  targetScaleMax?: number,
  roundingMode: RoundingMode = "half_up"
): {
  rawTotal: number | null;
  maxTotal: number;
  percentage: number | null;
  convertedTotal: number | null;
  completedCount: number;
  totalCount: number;
  hasMissing: boolean;
} {
  let rawTotal = 0;
  let maxTotal = 0;
  let completedCount = 0;
  const totalCount = scores.length;
  let anySubmitted = false;

  for (const s of scores) {
    maxTotal += s.max;
    if (s.score !== null && !Number.isNaN(s.score)) {
      rawTotal += s.score;
      completedCount++;
      anySubmitted = true;
    }
  }

  const hasMissing = completedCount < totalCount;

  if (!anySubmitted || maxTotal === 0) {
    return {
      rawTotal: null,
      maxTotal,
      percentage: null,
      convertedTotal: null,
      completedCount,
      totalCount,
      hasMissing: true,
    };
  }

  const roundedRaw = roundScore(rawTotal, roundingMode, 1);
  const rawPct = (roundedRaw / maxTotal) * 100;
  const roundedPct = roundScore(rawPct, roundingMode, 1);

  let convertedTotal: number | null = null;
  if (targetScaleMax && targetScaleMax > 0) {
    const scaled = (roundedRaw / maxTotal) * targetScaleMax;
    convertedTotal = roundScore(scaled, roundingMode, 1);
  }

  return {
    rawTotal: roundedRaw,
    maxTotal,
    percentage: roundedPct,
    convertedTotal,
    completedCount,
    totalCount,
    hasMissing,
  };
}

/**
 * Deterministically maps percentage to configured grade band
 */
export function resolveGradeBand(
  percentage: number | null | undefined,
  bands: GradeBand[] = DEFAULT_GRADE_BANDS
): { grade: string; descriptor: string } {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) {
    return { grade: "Incomplete", descriptor: "Missing Results" };
  }

  for (const band of bands) {
    if (percentage >= band.min_pct && percentage <= band.max_pct) {
      return { grade: band.grade, descriptor: band.descriptor };
    }
  }

  return { grade: "Ungraded", descriptor: "Outside defined bands" };
}
