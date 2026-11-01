import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foldersTable = pgTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shareToken: text("share_token").unique(),
  password: text("password"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFolderSchema = createInsertSchema(foldersTable).omit({
  createdAt: true,
});

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type FolderRecord = typeof foldersTable.$inferSelect;
