import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { db } from '../db/index.ts';
import { users, conversations, conversationMembers, messages, servers, serverMembers, channels } from '../db/schema.ts';
import { eq, or, like, and, desc, inArray } from 'drizzle-orm';

export const apiRouter = Router();

// ... existing profile update route ...
apiRouter.post('/profile', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { username, displayName } = req.body;
    if (!username) return res.status(400).json({ error: "Username is required" });

    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing.length > 0 && existing[0].uid !== req.dbUser.uid) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const updated = await db.update(users)
      .set({ username, displayName, updatedAt: new Date() })
      .where(eq(users.uid, req.dbUser.uid))
      .returning();

    res.json({ user: updated[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search users
apiRouter.get('/users/search', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json({ users: [] });

    const results = await db.select().from(users).where(
      or(
        like(users.username, `%${q}%`),
        like(users.displayName, `%${q}%`)
      )
    ).limit(10);
    
    res.json({ users: results.filter(u => u.uid !== req.dbUser.uid) });
  } catch (error) {
    res.status(500).json({ error: "Internal error" });
  }
});

// Get conversations
apiRouter.get('/conversations', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    // 1. Get all conversation IDs this user is part of
    const userMemberships = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, req.dbUser.id));
    const conversationIds = userMemberships.map(m => m.conversationId);
    
    if (conversationIds.length === 0) {
      return res.json({ conversations: [] });
    }

    // 2. Get conversations
    const convs = await db.select().from(conversations).where(inArray(conversations.id, conversationIds));
    
    // 3. For DMs, get the other member details
    const allMembers = await db.select().from(conversationMembers).where(inArray(conversationMembers.conversationId, conversationIds));
    const otherMemberIds = allMembers.filter(m => m.userId !== req.dbUser.id).map(m => m.userId);
    
    let otherUsers: any[] = [];
    if (otherMemberIds.length > 0) {
      otherUsers = await db.select().from(users).where(inArray(users.id, otherMemberIds));
    }

    // 4. Assemble
    const result = convs.map(conv => {
      let otherMember = null;
      if (!conv.isGroup) {
        const otherMembership = allMembers.find(m => m.conversationId === conv.id && m.userId !== req.dbUser.id);
        if (otherMembership) {
          otherMember = otherUsers.find(u => u.id === otherMembership.userId);
        }
      }
      return {
        ...conv,
        otherMember
      };
    });

    // 5. Remove duplicate DMs from the response (can happen from older data)
    const uniqueResult: any[] = [];
    const seenUserIds = new Set();
    
    for (const conv of result) {
      if (!conv.isGroup && conv.otherMember) {
        if (seenUserIds.has(conv.otherMember.id)) {
          continue; // Skip duplicate DM
        }
        seenUserIds.add(conv.otherMember.id);
      }
      uniqueResult.push(conv);
    }

    res.json({ conversations: uniqueResult });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Create/Get DM
apiRouter.post('/conversations', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "targetUserId required" });

    // Check for existing DM conversation between the two users
    const myConvs = await db.select().from(conversationMembers).where(eq(conversationMembers.userId, req.dbUser.id));
    const myConvIds = myConvs.map(c => c.conversationId);

    if (myConvIds.length > 0) {
      const targetConvs = await db.select().from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.userId, targetUserId),
            inArray(conversationMembers.conversationId, myConvIds)
          )
        );
      
      const targetConvIds = targetConvs.map(c => c.conversationId);
      if (targetConvIds.length > 0) {
        const existingConvs = await db.select().from(conversations)
          .where(
            and(
              eq(conversations.isGroup, false),
              inArray(conversations.id, targetConvIds)
            )
          );
        
        if (existingConvs.length > 0) {
          return res.json({ conversation: existingConvs[0] });
        }
      }
    }
    
    const newConv = await db.insert(conversations).values({ isGroup: false }).returning();
    
    await db.insert(conversationMembers).values([
      { conversationId: newConv[0].id, userId: req.dbUser.id },
      { conversationId: newConv[0].id, userId: targetUserId }
    ]);
    
    res.json({ conversation: newConv[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get Messages
apiRouter.get('/conversations/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const conversationId = parseInt(req.params.id);
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(100);
      
    // Fetch senders for these messages
    const senderIds = [...new Set(msgs.map(m => m.senderId))];
    let senders: any[] = [];
    if (senderIds.length > 0) {
      senders = await db.select().from(users).where(inArray(users.id, senderIds));
    }
    
    const assembledMsgs = msgs.map(m => ({
      ...m,
      sender: senders.find(s => s.id === m.senderId)
    }));

    res.json({ messages: assembledMsgs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Create a server
apiRouter.post('/servers', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Server name is required" });

    // Insert server
    const newServer = await db.insert(servers).values({
      name,
      ownerId: req.dbUser.id
    }).returning();

    // Insert owner as member
    await db.insert(serverMembers).values({
      serverId: newServer[0].id,
      userId: req.dbUser.id,
      role: 'owner'
    });

    // Create a default general channel
    const defaultChannel = await db.insert(channels).values({
      serverId: newServer[0].id,
      name: 'general',
      type: 'text'
    }).returning();

    res.json({ server: newServer[0], defaultChannel: defaultChannel[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create server" });
  }
});

// Get user's servers
apiRouter.get('/servers', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const memberships = await db.select().from(serverMembers).where(eq(serverMembers.userId, req.dbUser.id));
    const serverIds = memberships.map(m => m.serverId);
    
    if (serverIds.length === 0) return res.json({ servers: [] });

    const userServers = await db.select().from(servers).where(inArray(servers.id, serverIds));
    res.json({ servers: userServers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch servers" });
  }
});

// Get server channels
apiRouter.get('/servers/:id/channels', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const serverId = parseInt(req.params.id);
    const serverChannels = await db.select().from(channels).where(eq(channels.serverId, serverId));
    res.json({ channels: serverChannels });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// Get Channel Messages
apiRouter.get('/channels/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const channelId = parseInt(req.params.id);
    const msgs = await db.select().from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(messages.createdAt)
      .limit(100);
      
    // Fetch senders for these messages
    const senderIds = [...new Set(msgs.map(m => m.senderId))];
    let senders: any[] = [];
    if (senderIds.length > 0) {
      senders = await db.select().from(users).where(inArray(users.id, senderIds));
    }
    
    const assembledMsgs = msgs.map(m => ({
      ...m,
      sender: senders.find(s => s.id === m.senderId)
    }));

    res.json({ messages: assembledMsgs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});
