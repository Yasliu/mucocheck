import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "—";
  }
  return Number.isInteger(score) ? score.toString() : score.toFixed(1);
}

export function formatPercentage(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return "—";
  }
  return `${Math.round(pct * 10) / 10}%`;
}
