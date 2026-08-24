import { Router } from "express";
import { prisma } from "../db/prisma.ts";
import { requireAuth } from "../middlewares/auth.middleware.ts";

export const usersRouter = Router();

usersRouter.delete("/:id", requireAuth, async (request, response, next) => {
  try {
    const userId = Number(request.params.id);

    if (!Number.isInteger(userId)) {
      return response.status(400).json({
        error: "Invalid user id",
      });
    }

    if (!request.authUser) {
      return response.status(401).json({
        error: "Authentication is required",
      });
    }

    if (request.authUser.id !== userId) {
      return response.status(403).json({
        error: "Forbidden",
      });
    }

    const updateResult = await prisma.user.updateMany({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    if (updateResult.count === 0) {
      return response.status(404).json({
        error: "User not found",
      });
    }

    return response.status(204).send();
  } catch (error) {
    next(error);
  }
});