import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  username: varchar('username', { length: 255 }).unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  status: varchar('status', { length: 255 }).default('offline'),
  bio: text('bio'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  deviceId: text('device_id').notNull().unique(),
  platform: varchar('platform', { length: 100 }),
  publicKey: text('public_key').notNull(), // For E2EE
  lastActive: timestamp('last_active').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  isGroup: boolean('is_group').default(false).notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversationMembers = pgTable('conversation_members', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id),
  channelId: integer('channel_id').references(() => channels.id),
  senderId: integer('sender_id').references(() => users.id).notNull(),
  encryptedContent: text('encrypted_content').notNull(), // E2EE payload
  type: varchar('type', { length: 50 }).default('text').notNull(),
  status: varchar('status', { length: 50 }).default('sent').notNull(),
  replyToId: integer('reply_to_id'), // Self-reference added below in relations if needed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const servers = pgTable('servers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  iconUrl: text('icon_url'),
  ownerId: integer('owner_id').references(() => users.id).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const serverMembers = pgTable('server_members', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').references(() => servers.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').references(() => servers.id).notNull(),
  name: text('name').notNull(),
  type: varchar('type', { length: 50 }).default('text').notNull(), // text, voice
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  devices: many(devices),
  memberships: many(conversationMembers),
  messages: many(messages),
  serverMemberships: many(serverMembers),
  ownedServers: many(servers),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  members: many(conversationMembers),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const serversRelations = relations(servers, ({ many, one }) => ({
  members: many(serverMembers),
  channels: many(channels),
  owner: one(users, {
    fields: [servers.ownerId],
    references: [users.id],
  }),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  messages: many(messages),
}));
