import cors from "cors";
import express from "express";
import { prisma } from "./db/prisma.ts";
import { userRouter } from "./routes/user.ts";
import { userApplicationRouter } from "./routes/user-applications.ts";

export const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", userRouter);
app.use("/api/user-applications", userApplicationRouter);

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
