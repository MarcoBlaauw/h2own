import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db as dbClient } from '../db/index.js';
import * as schema from '../db/schema/index.js';

type ListThreadsFilters = {
  limit?: number;
  cursor?: string;
  poolId?: string;
  unreadOnly?: boolean;
};

type ListMessagesCursor = {
  before?: string;
  limit?: number;
};

const decodeMessageCursor = (cursor?: string) => {
  if (!cursor) return null;
  const [createdAtRaw, messageIdRaw] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!createdAtRaw || !messageIdRaw) return null;
  const createdAt = new Date(createdAtRaw);
  const messageId = Number(messageIdRaw);
  if (Number.isNaN(createdAt.getTime()) || !Number.isFinite(messageId)) return null;
  return { createdAt, messageId };
};

const encodeMessageCursor = (createdAt: Date, messageId: number) =>
  Buffer.from(`${createdAt.toISOString()}|${messageId}`, 'utf8').toString('base64url');

export class MessagesService {
  constructor(private readonly db = dbClient) {}

  async listThreads(userId: string, filters: ListThreadsFilters = {}) {
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const threadRows = await this.db
      .select({
        threadId: schema.messageThreads.threadId,
        subject: schema.messageThreads.subject,
        poolId: schema.messageThreads.poolId,
        createdBy: schema.messageThreads.createdBy,
        updatedAt: schema.messageThreads.updatedAt,
        participantLastReadAt: schema.threadParticipants.lastReadAt,
        messageCount: sql<number>`count(${schema.messages.messageId})::int`,
        lastMessageAt: sql<Date | null>`max(${schema.messages.createdAt})`,
        lastMessageBody: sql<string | null>`(
          SELECT m.body
          FROM messages m
          WHERE m.thread_id = ${schema.messageThreads.threadId}
            AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC, m.message_id DESC
          LIMIT 1
        )`,
        unreadCount: sql<number>`(
          SELECT count(*)::int
          FROM messages unread
          WHERE unread.thread_id = ${schema.messageThreads.threadId}
            AND unread.deleted_at IS NULL
            AND unread.sender_user_id <> ${userId}
            AND (
              ${schema.threadParticipants.lastReadAt} IS NULL
              OR unread.created_at > ${schema.threadParticipants.lastReadAt}
            )
        )`,
      })
      .from(schema.threadParticipants)
      .innerJoin(
        schema.messageThreads,
        eq(schema.messageThreads.threadId, schema.threadParticipants.threadId)
      )
      .leftJoin(schema.messages, eq(schema.messages.threadId, schema.messageThreads.threadId))
      .where(
        and(
          eq(schema.threadParticipants.userId, userId),
          filters.poolId ? eq(schema.messageThreads.poolId, filters.poolId) : undefined,
          filters.cursor ? ltCursorClause(filters.cursor) : undefined
        )
      )
      .groupBy(
        schema.messageThreads.threadId,
        schema.messageThreads.subject,
        schema.messageThreads.poolId,
        schema.messageThreads.createdBy,
        schema.messageThreads.updatedAt,
        schema.threadParticipants.lastReadAt
      )
      .orderBy(desc(sql`coalesce(max(${schema.messages.createdAt}), ${schema.messageThreads.updatedAt})`))
      .limit(limit + 1);

    const filteredRows = filters.unreadOnly ? threadRows.filter((row) => Number(row.unreadCount) > 0) : threadRows;
    const hasMore = filteredRows.length > limit;
    const items = filteredRows.slice(0, limit);

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]?.updatedAt?.toISOString() ?? null : null,
    };
  }

  async getThread(threadId: string, userId: string) {
    const [thread] = await this.db
      .select({
        threadId: schema.messageThreads.threadId,
        subject: schema.messageThreads.subject,
        poolId: schema.messageThreads.poolId,
        createdBy: schema.messageThreads.createdBy,
        createdAt: schema.messageThreads.createdAt,
        updatedAt: schema.messageThreads.updatedAt,
      })
      .from(schema.messageThreads)
      .innerJoin(
        schema.threadParticipants,
        and(
          eq(schema.threadParticipants.threadId, schema.messageThreads.threadId),
          eq(schema.threadParticipants.userId, userId)
        )
      )
      .where(eq(schema.messageThreads.threadId, threadId));

    if (!thread) return null;

    const participants = await this.db
      .select({
        userId: schema.threadParticipants.userId,
        role: schema.threadParticipants.role,
        metadata: schema.threadParticipants.metadata,
        lastReadAt: schema.threadParticipants.lastReadAt,
        mutedUntil: schema.threadParticipants.mutedUntil,
      })
      .from(schema.threadParticipants)
      .where(eq(schema.threadParticipants.threadId, threadId));

    return { ...thread, participants };
  }

  async listMessages(threadId: string, userId: string, cursor: ListMessagesCursor = {}) {
    const isMember = await this.isParticipant(threadId, userId);
    if (!isMember) return null;

    const limit = Math.min(100, Math.max(1, cursor.limit ?? 30));
    const decoded = decodeMessageCursor(cursor.before);

    const rows = await this.db
      .select({
        messageId: schema.messages.messageId,
        threadId: schema.messages.threadId,
        senderUserId: schema.messages.senderUserId,
        body: schema.messages.body,
        attachments: schema.messages.attachments,
        createdAt: schema.messages.createdAt,
        editedAt: schema.messages.editedAt,
        deletedAt: schema.messages.deletedAt,
      })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.threadId, threadId),
          isNull(schema.messages.deletedAt),
          decoded
            ? or(
                sql`${schema.messages.createdAt} < ${decoded.createdAt}`,
                and(
                  eq(schema.messages.createdAt, decoded.createdAt),
                  sql`${schema.messages.messageId} < ${decoded.messageId}`
                )
              )
            : undefined
        )
      )
      .orderBy(desc(schema.messages.createdAt), desc(schema.messages.messageId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const nextCursor = hasMore
      ? encodeMessageCursor(items[items.length - 1].createdAt as Date, items[items.length - 1].messageId)
      : null;

    return { items, nextCursor };
  }

  async createThread(
    senderId: string,
    participantIds: string[],
    initialMessage: { body: string; attachments?: unknown; subject?: string },
    poolId?: string
  ) {
    const dedupedParticipants = Array.from(new Set([senderId, ...participantIds]));

    const [thread] = await this.db
      .insert(schema.messageThreads)
      .values({ createdBy: senderId, poolId: poolId ?? null, subject: initialMessage.subject ?? null })
      .returning();

    await this.db.insert(schema.threadParticipants).values(
      dedupedParticipants.map((participantId) => ({
        threadId: thread.threadId,
        userId: participantId,
        role: participantId === senderId ? 'owner' : 'member',
        lastReadAt: participantId === senderId ? new Date() : null,
      }))
    );

    const message = await this.sendMessage(thread.threadId, senderId, initialMessage.body, initialMessage.attachments);

    return { thread, message, participantCount: dedupedParticipants.length };
  }

  async sendMessage(threadId: string, senderId: string, body: string, attachments?: unknown) {
    const isMember = await this.isParticipant(threadId, senderId);
    if (!isMember) return null;

    const [message] = await this.db
      .insert(schema.messages)
      .values({
        threadId,
        senderUserId: senderId,
        body,
        attachments: attachments ?? null,
      })
      .returning();

    await this.db
      .update(schema.messageThreads)
      .set({ updatedAt: new Date() })
      .where(eq(schema.messageThreads.threadId, threadId));

    const recipients = await this.db
      .select({ userId: schema.threadParticipants.userId })
      .from(schema.threadParticipants)
      .where(and(eq(schema.threadParticipants.threadId, threadId), ne(schema.threadParticipants.userId, senderId)));

    if (recipients.length > 0) {
      await this.db.insert(schema.messageDeliveries).values(
        recipients.map((recipient) => ({
          messageId: message.messageId,
          userId: recipient.userId,
          deliveredAt: new Date(),
        }))
      );
    }

    return { message, recipientCount: recipients.length };
  }

  async markThreadRead(threadId: string, userId: string, readAt: Date) {
    const [row] = await this.db
      .update(schema.threadParticipants)
      .set({ lastReadAt: readAt, updatedAt: new Date() })
      .where(
        and(eq(schema.threadParticipants.threadId, threadId), eq(schema.threadParticipants.userId, userId))
      )
      .returning({ threadId: schema.threadParticipants.threadId, userId: schema.threadParticipants.userId });

    return row ?? null;
  }

  async isParticipant(threadId: string, userId: string) {
    const [row] = await this.db
      .select({ threadId: schema.threadParticipants.threadId })
      .from(schema.threadParticipants)
      .where(and(eq(schema.threadParticipants.threadId, threadId), eq(schema.threadParticipants.userId, userId)));
    return Boolean(row);
  }
}

const ltCursorClause = (cursor: string) => {
  const date = new Date(cursor);
  if (Number.isNaN(date.getTime())) return undefined;
  return sql`${schema.messageThreads.updatedAt} < ${date}`;
};

export const messagesService = new MessagesService();
