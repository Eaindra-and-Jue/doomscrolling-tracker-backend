import { Router } from "express";
import { prisma } from "../db/prisma.ts";
import { requireAuth } from "../middlewares/auth.middleware.ts";

export const usersRouter = Router();

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     summary: Soft delete a user
 *     description: Marks the authenticated user's account as deleted by setting deletedAt and isActive=false. Only the user themself can delete their own account.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to soft delete
 *     responses:
 *       204:
 *         description: User soft deleted successfully
 *       400:
 *         description: Invalid user id
 *       401:
 *         description: Missing or invalid authentication token
 *       403:
 *         description: User is not allowed to delete this account
 *       404:
 *         description: User not found or already deleted
 */
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