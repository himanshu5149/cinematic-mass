import type { HighScore } from "./types";

const KEY = "raji-eternal-pact-scores-v1";

export function titleForScore(score: number, wave: number): string {
  if (score >= 40000 || wave >= 16) return "Bhumi Rakshak";
  if (score >= 22000 || wave >= 12) return "Mahadevi's Chosen";
  if (score >= 12000 || wave >= 9) return "Trishula Wielder";
  if (score >= 6000 || wave >= 6) return "Asura Slayer";
  if (score >= 2500 || wave >= 4) return "Pact Bearer";
  if (score >= 800) return "Village Guardian";
  return "Novice Seeker";
}

export function loadScores(): HighScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HighScore[];
    return parsed
      .filter((s) => s && typeof s.score === "number")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function saveScore(entry: Omit<HighScore, "title" | "at">): HighScore[] {
  const next: HighScore = {
    ...entry,
    title: titleForScore(entry.score, entry.wave),
    at: Date.now(),
  };
  const all = [...loadScores(), next].sort((a, b) => b.score - a.score).slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(all));
  return all;
}
