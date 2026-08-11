import { Router } from "express";
import { requireAuth } from "../middleware/auth.ts";
import { prisma } from "../db/prisma.ts";

export const userApplicationRouter = Router();
userApplicationRouter.use(requireAuth);

userApplicationRouter.get("/", async (request, response, next) => {
  try {
    const userId = request.authUser!.id;

    const userApplications = await prisma.applicationUser.findMany({
      where: {
        userId,
      },
      include: {
        application: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    response.json({ userApplications });
  } catch (error) {
    next(error);
  }
});
