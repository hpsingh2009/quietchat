import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, displayName: string, avatarUrl: string | null) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        displayName,
        avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          displayName,
          avatarUrl,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database query failed:", error);
    throw new Error("Failed to get or create user", { cause: error });
  }
}
