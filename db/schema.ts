import { bigint, index, int, mysqlEnum, mysqlTable, serial, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export const gameProfiles = mysqlTable("game_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().unique().references(() => users.id),
  bestScore: int("bestScore").default(0).notNull(),
  totalShards: int("totalShards").default(0).notNull(),
  runs: int("runs").default(0).notNull(),
  wins: int("wins").default(0).notNull(),
  bestWave: int("bestWave").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({ scoreIdx: index("score_idx").on(table.bestScore) }));

export const gameRuns = mysqlTable("game_runs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().references(() => users.id),
  score: int("score").notNull(),
  wave: int("wave").notNull(),
  kills: int("kills").notNull(),
  durationMs: int("durationMs").notNull(),
  shards: int("shards").notNull(),
  victory: boolean("victory").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIdx: index("run_user_idx").on(table.userId), scoreIdx: index("run_score_idx").on(table.score) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type GameProfile = typeof gameProfiles.$inferSelect;
export type GameRun = typeof gameRuns.$inferSelect;
