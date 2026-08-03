import type { AuthenticatedUser } from "../middleware/auth.ts";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export {};
