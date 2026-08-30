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

userApplicationRouter.post("/", async (request, response, next) => {
  try {
    const userId = request.authUser!.id;

    const { applicationId } = request.body as {
      applicationId?: unknown;
    };

    if (
      typeof applicationId !== "number" ||
      !Number.isInteger(applicationId) ||
      applicationId <= 0
    ) {
      response.status(400).json({
        error: "applicationId must be a positive integer",
      });
      return;
    }

    const application = await prisma.application.findUnique({
      where: {
        id: applicationId,
      },
    });

    if (!application) {
      response.status(404).json({
        error: "Application not found",
      });
      return;
    }

    const existingUserApplication = await prisma.applicationUser.findUnique({
      where: {
        applicationId_userId: {
          applicationId,
          userId,
        },
      },
    });

    if (existingUserApplication) {
      response.status(409).json({
        error: "Application is already assigned to this user",
      });
      return;
    }

    const userApplication = await prisma.applicationUser.create({
      data: {
        userId,
        applicationId,
      },
      include: {
        application: true,
      },
    });

    response.status(201).json({
      userApplication,
    });
  } catch (error) {
    next(error);
  }
});

userApplicationRouter.put("/:id", async (request, response, next) => {
  try {
    const userId = request.authUser!.id;
    const { applicationId } = request.body as {
      applicationId?: unknown;
    };
    const relationshipId = Number(request.params.id);

    if (!Number.isInteger(relationshipId) || relationshipId <= 0) {
      response.status(400).json({
        error: "id must be a positive integer",
      });
      return;
    }

    if (
      typeof applicationId !== "number" ||
      !Number.isInteger(applicationId) ||
      applicationId <= 0
    ) {
      response.status(400).json({
        error: "applicationId must be a positive integer",
      });
      return;
    }

    const ownedUserApplication = await prisma.applicationUser.findFirst({
      where: {
        id: relationshipId,
        userId,
      },
    });

    if (!ownedUserApplication) {
      response.status(404).json({
        error: "User application not found",
      });
      return;
    }

    const application = await prisma.application.findUnique({
      where: {
        id: applicationId,
      },
    });

    if (!application) {
      response.status(404).json({
        error: "Application not found",
      });
      return;
    }

    if (ownedUserApplication.applicationId !== applicationId) {
      const existingUserApplication = await prisma.applicationUser.findUnique({
        where: {
          applicationId_userId: {
            userId,
            applicationId,
          },
        },
      });

      if (existingUserApplication) {
        response.status(409).json({
          error: "Application is already assigned to this user",
        });
        return;
      }
    }

    const userApplication = await prisma.applicationUser.update({
      where: {
        id: relationshipId,
      },
      data: {
        applicationId,
      },
      include: {
        application: true,
      },
    });

    response.status(200).json({
      userApplication,
    });
  } catch (error) {
    next(error);
  }
});

userApplicationRouter.delete("/:id", async (request, response, next) => {
  try {
    const userId = request.authUser!.id;
    const relationshipId = Number(request.params.id);

    if (!Number.isInteger(relationshipId) || relationshipId <= 0) {
      response.status(400).json({
        error: "id must be a positive integer",
      });
      return;
    }

    const ownedUserApplication = await prisma.applicationUser.findFirst({
      where: {
        id: relationshipId,
        userId,
      },
    });

    if (!ownedUserApplication) {
      response.status(404).json({
        error: "User application not found",
      });
      return;
    }

    await prisma.applicationUser.delete({
      where: {
        id: relationshipId,
        userId,
      },
    });

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
