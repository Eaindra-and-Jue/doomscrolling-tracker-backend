import { Router } from "express";
import { requireAuth } from "../middleware/auth.ts";

export const userApplicationRouter = Router();
userApplicationRouter.use(requireAuth);
