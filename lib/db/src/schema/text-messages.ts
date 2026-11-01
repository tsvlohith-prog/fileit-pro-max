import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const textMessagesTable = pgTable("text_messages", {
  id: text("id").primaryKey(),
  title: text("title").notNull().default("Untitled snippet"),
  content: text("content").notNull(),
  language: text("language").notNull().default("plaintext"),
  fileId: text("file_id"),
  folderId: text("folder_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTextMessageSchema = createInsertSchema(textMessagesTable)
  .omit({
    createdAt: true,
  })
  .extend({
    title: z.string().optional(),
    language: z.string().optional(),
    fileId: z.string().optional(),
    folderId: z.string().optional(),
  });

export type InsertTextMessage = z.infer<typeof insertTextMessageSchema>;
export type TextMessageRecord = typeof textMessagesTable.$inferSelect;
