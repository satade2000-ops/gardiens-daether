import { desc, eq } from "drizzle-orm";
import { gameProfiles, gameRuns, users } from "@db/schema";
import { getDb } from "./connection";

export async function getLeaderboard() {
  return getDb().select({
    name: users.name,
    bestScore: gameProfiles.bestScore,
    wins: gameProfiles.wins,
    runs: gameProfiles.runs,
  }).from(gameProfiles)
    .innerJoin(users, eq(gameProfiles.userId, users.id))
    .orderBy(desc(gameProfiles.bestScore))
    .limit(10);
}

export async function getProfile(userId: number) {
  const rows = await getDb().select().from(gameProfiles).where(eq(gameProfiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function ensureProfile(userId: number) {
  await getDb().insert(gameProfiles).values({ userId }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  return getProfile(userId);
}

export interface RunResult {
  score: number;
  wave: number;
  kills: number;
  durationMs: number;
  shards: number;
  victory: boolean;
}

export async function saveRun(userId: number, result: RunResult) {
  await getDb().transaction(async (tx) => {
    await tx.insert(gameRuns).values({ userId, ...result });
    const existing = await tx.select().from(gameProfiles).where(eq(gameProfiles.userId, userId)).limit(1);
    const profile = existing[0];
    if (!profile) {
      await tx.insert(gameProfiles).values({
        userId, bestScore: result.score, totalShards: result.shards, runs: 1,
        wins: result.victory ? 1 : 0, bestWave: result.wave,
      });
    } else {
      await tx.update(gameProfiles).set({
        bestScore: Math.max(profile.bestScore, result.score),
        totalShards: profile.totalShards + result.shards,
        runs: profile.runs + 1,
        wins: profile.wins + (result.victory ? 1 : 0),
        bestWave: Math.max(profile.bestWave, result.wave),
      }).where(eq(gameProfiles.userId, userId));
    }
  });
  return getProfile(userId);
}
