import type { SessionUser } from "./lib/session.js";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export {};
