import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    // ephemeral view of the current session (loaded on each request)
    session?: {
      id?: string | null;         // opaque session id, if present
      userId?: string | null;     // authenticated user id, if present
      role?: string | null;       // optional role, if you store it
      delete: () => Promise<void>;
    };
    user?: { id: string; role?: string };
  }
  interface FastifyInstance {
    // global auth helpers
    auth: {
      verifySession: (req: any, reply: any) => Promise<void>;
      requireRole: (role: string) => (req: any, reply: any) => Promise<void>;
    };
    // session utility API used by routes (login/logout)
    sessions: {
      create: (reply: any, userId: string, role?: string) => Promise<string>;
      destroy: (reply: any, sid?: string | null) => Promise<void>;
      touch: (sid: string) => void; // optional idle-refresh if you want it
    };
  }
}
