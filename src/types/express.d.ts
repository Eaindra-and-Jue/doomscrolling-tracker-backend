import type { AuthenticatedUser } from "../middlewares/auth.ts";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

export { };
