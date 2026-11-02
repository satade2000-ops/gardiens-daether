import { authRouter } from "./auth-router";
import { gameRouter } from "./gameRouter";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
