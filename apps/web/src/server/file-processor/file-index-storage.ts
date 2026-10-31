import { db } from "@teachanything/db";
import { fileChunks, userFiles } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";

type FileChunkInsert = typeof fileChunks.$inferInsert;
type UserFileInsert = typeof userFiles.$inferInsert;

/** Replace chunks and mark the file complete in one database transaction. */
export async function replaceFileIndex(params: {
  fileId: string;
  chunks: FileChunkInsert[];
  metadata: NonNullable<UserFileInsert["metadata"]>;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(fileChunks).where(eq(fileChunks.fileId, params.fileId));
    await tx.insert(fileChunks).values(params.chunks);
    await tx
      .update(userFiles)
      .set({ processingStatus: "completed", metadata: params.metadata })
      .where(eq(userFiles.id, params.fileId));
  });
}
