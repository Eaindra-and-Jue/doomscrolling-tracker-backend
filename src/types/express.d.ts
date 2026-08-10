import type { AuthenticatedUser } from "../middlewares/auth.middleware.ts";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export { };
