import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./config/env.ts";
import { prisma } from "./db/prisma.ts";
import { authRouter } from "./routes/auth.routes.ts";
import { router as applicationsRouter } from "./routes/applications.ts";

export const app = express();

app.use(
  cors({
    credentials: true,
    origin: env.nodeEnv === "production" ? env.corsOrigin ?? false : true,
  }),
);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "doomscrolling-tracker-backend",
      version: "1.0.0",
      description: "API docs for the doomscrolling-tracker-backend",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/app.ts"],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(cookieParser());
app.use(express.json());

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

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error(error);
  response.status(500).json({
    error: "Internal server error",
  });
});
