import { db } from "@workspace/db";
import { filesTable, foldersTable } from "@workspace/db/schema";
import { lt, eq, and } from "drizzle-orm";
import { deleteFile as deleteStorageFile } from "./lib/fileStorage";

export async function cleanupExpiredFilesAndFolders() {
  const now = new Date();
  
  // Cleanup files (except starred)
  try {
    const expiredFiles = await db.select().from(filesTable).where(
      and(
        lt(filesTable.expiresAt, now),
        eq(filesTable.isStarred, false)
      )
    );
    
    for (const file of expiredFiles) {
      if (file.storagePath) {
        await deleteStorageFile(file.storagePath).catch(() => {});
      }
      await db.delete(filesTable).where(eq(filesTable.id, file.id));
    }
  } catch (err) {
    console.error("Cleanup expired files error:", err);
  }

  // Cleanup folders (Private rooms)
  try {
    const expiredFolders = await db.select().from(foldersTable).where(lt(foldersTable.expiresAt, now));
    
    for (const folder of expiredFolders) {
      // Get all files in this folder to delete storage
      const folderFiles = await db.select().from(filesTable).where(eq(filesTable.folderId, folder.id));
      for (const file of folderFiles) {
         if (file.storagePath) {
           await deleteStorageFile(file.storagePath).catch(() => {});
         }
      }
      await db.delete(foldersTable).where(eq(foldersTable.id, folder.id));
    }
  } catch (err) {
    console.error("Cleanup expired folders error:", err);
  }
}
