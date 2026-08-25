import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { adminAuth } from "./src/lib/firebase-admin.ts";
import { apiRouter } from "./src/routes/api.ts";
import { db } from "./src/db/index.ts";
import { messages, users } from "./src/db/schema.ts";
import { eq } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/me", requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.dbUser });
  });

  app.use("/api", apiRouter);

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      
      // Get DB user for socket
      const userRecs = await db.select().from(users).where(eq(users.uid, decodedToken.uid));
      if (userRecs.length > 0) {
        socket.data.dbUser = userRecs[0];
      }
      
      socket.data.user = decodedToken;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.data.user.uid}`);

    socket.on("join-server", (serverId: string) => {
      socket.join(`server_${serverId}`);
    });

    socket.on("join-conversation", (conversationId: number) => {
      socket.join(`conversation_${conversationId}`);
    });

    socket.on("join-channel", (channelId: number) => {
      socket.join(`channel_${channelId}`);
    });

    // WebRTC Signaling
    socket.on("call-user", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("incoming-call", {
        from: socket.data.dbUser,
        conversationId: data.conversationId,
        isVideo: data.isVideo
      });
    });

    socket.on("accept-call", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("call-accepted", {
        from: socket.data.dbUser
      });
    });

    socket.on("reject-call", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("call-rejected", {
        from: socket.data.dbUser
      });
    });

    socket.on("webrtc-offer", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("webrtc-offer", data);
    });

    socket.on("webrtc-answer", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("webrtc-answer", data);
    });

    socket.on("webrtc-ice-candidate", (data) => {
      socket.to(`conversation_${data.conversationId}`).emit("webrtc-ice-candidate", data);
    });

    socket.on("end-call", (data) => {
      io.to(`conversation_${data.conversationId}`).emit("call-ended");
    });

    socket.on("send-message", async (data) => {
      try {
        const { conversationId, channelId, encryptedContent, type = 'text', tempId } = data;
        const senderId = socket.data.dbUser.id;

        // Save to DB
        const newMsg = await db.insert(messages).values({
          conversationId: conversationId || null,
          channelId: channelId || null,
          senderId,
          encryptedContent,
          type
        }).returning();

        const msgObj = {
          ...newMsg[0],
          sender: socket.data.dbUser,
          tempId // Echo tempId back so sender can replace optimistic message
        };

        // Broadcast to everyone
        if (conversationId) {
          io.to(`conversation_${conversationId}`).emit("receive-message", msgObj);
        } else if (channelId) {
          io.to(`channel_${channelId}`).emit("receive-message", msgObj);
        }
      } catch (err) {
        console.error("Error sending message:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.data.user.uid}`);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
