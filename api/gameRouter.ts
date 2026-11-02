import { z } from "zod";
import { authedQuery, createRouter, publicQuery } from "./middleware";
import { ensureProfile, getLeaderboard, getProfile, saveRun } from "./queries/game";

export const gameRouter = createRouter({
  leaderboard: publicQuery.query(() => getLeaderboard()),
  profile: authedQuery.query(async ({ ctx }) => {
    return (await getProfile(ctx.user.id)) ?? ensureProfile(ctx.user.id);
  }),
  submitRun: authedQuery.input(z.object({
    score: z.number().int().min(0).max(10_000_000),
    wave: z.number().int().min(1).max(4),
    kills: z.number().int().min(0).max(1000),
    durationMs: z.number().int().min(1000).max(3_600_000),
    shards: z.number().int().min(0).max(10_000),
    victory: z.boolean(),
  })).mutation(({ ctx, input }) => saveRun(ctx.user.id, input)),
});
