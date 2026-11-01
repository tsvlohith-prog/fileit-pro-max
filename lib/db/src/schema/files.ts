import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const filesTable = pgTable("files", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  shareToken: text("share_token").notNull().unique(),
  storagePath: text("storage_path").notNull(),
  folderId: text("folder_id"),
  downloadCount: integer("download_count").notNull().default(0),
  isStarred: boolean("is_starred").notNull().default(false),
  expiresAt: timestamp("expires_at"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(filesTable).omit({
  downloadCount: true,
  createdAt: true,
}).extend({
  folderId: z.string().optional(),
});

export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileRecord = typeof filesTable.$inferSelect;
