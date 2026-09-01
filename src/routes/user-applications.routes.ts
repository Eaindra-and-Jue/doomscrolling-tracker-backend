import { Router } from "express";
import {
  createUserApplication,
  deleteUserApplication,
  listUserApplications,
  updateUserApplication,
} from "../controllers/user-applications.controller.ts";
import { requireAuth } from "../middlewares/auth.middleware.ts";

export const userApplicationRouter = Router();

userApplicationRouter.use(requireAuth);
userApplicationRouter.get("/", listUserApplications);
userApplicationRouter.post("/", createUserApplication);
userApplicationRouter.put("/:id", updateUserApplication);
userApplicationRouter.delete("/:id", deleteUserApplication);
