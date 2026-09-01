import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { prisma } from "./db/prisma.ts";
import { swaggerSpec } from "./docs/swagger.ts";
import { errorHandler } from "./middlewares/error.middleware.ts";
import { userApplicationRouter } from "./routes/user-applications.routes.ts";
import { authRouter } from "./routes/auth.routes.ts";
import { router as applicationsRouter } from "./routes/applications.routes.ts";

export const app = express();

app.use(cors());

app.get("/docs.json", (_request, response) => {
  response.json(swaggerSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());

app.use("/api/user-applications", userApplicationRouter);
app.use("/api/auth", authRouter);
app.use(applicationsRouter);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "doomscrolling-tracker-backend",
  });
});

app.get("/health/db", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);
