import type { RequestHandler } from "express";
import { prisma } from "../db/prisma.ts";

type UserApplicationBody = {
  applicationId?: unknown;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export const listUserApplications: RequestHandler = async (request, response, next) => {
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
};

export const createUserApplication: RequestHandler = async (request, response, next) => {
  try {
    const userId = request.authUser!.id;
    const { applicationId } = request.body as UserApplicationBody;

    if (!isPositiveInteger(applicationId)) {
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
};

export const updateUserApplication: RequestHandler = async (request, response, next) => {
  try {
    const userId = request.authUser!.id;
    const { applicationId } = request.body as UserApplicationBody;
    const relationshipId = Number(request.params.id);

    if (!isPositiveInteger(relationshipId)) {
      response.status(400).json({
        error: "id must be a positive integer",
      });
      return;
    }

    if (!isPositiveInteger(applicationId)) {
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
};

export const deleteUserApplication: RequestHandler = async (request, response, next) => {
  try {
    const userId = request.authUser!.id;
    const relationshipId = Number(request.params.id);

    if (!isPositiveInteger(relationshipId)) {
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
};
