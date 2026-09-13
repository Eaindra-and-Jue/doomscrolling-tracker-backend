import { fileURLToPath } from "node:url";
import swaggerJsdoc from "swagger-jsdoc";

const routesPattern = fileURLToPath(new URL("../routes/*.ts", import.meta.url));
const docsPattern = fileURLToPath(new URL("./*.ts", import.meta.url));

const swaggerOptions: swaggerJsdoc.OAS3Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "doomscrolling-tracker-backend",
      version: "1.0.0",
      description: "API docs for the doomscrolling-tracker-backend",
    },
    tags: [
      {
        name: "Authentication",
        description: "Register, log in, and inspect the authenticated user",
      },
      {
        name: "Applications",
        description: "Browse the application catalog",
      },
      {
        name: "User Applications",
        description: "Manage applications selected by the authenticated user",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Application: {
          type: "object",
          required: ["id", "name", "platform", "packageName"],
          properties: {
            id: { type: "integer", example: 7 },
            name: { type: "string", example: "YouTube" },
            platform: { type: "string", example: "android" },
            packageName: { type: "string", example: "com.google.android.youtube" },
          },
        },
        UserApplication: {
          type: "object",
          required: ["id", "userId", "applicationId", "application"],
          properties: {
            id: { type: "integer", example: 10 },
            userId: { type: "integer", example: 1 },
            applicationId: { type: "integer", example: 7 },
            application: { $ref: "#/components/schemas/Application" },
          },
        },
        UserApplicationRequest: {
          type: "object",
          required: ["applicationId"],
          properties: {
            applicationId: {
              type: "integer",
              minimum: 1,
              example: 7,
            },
          },
        },
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "string",
              example: "User application not found",
            },
          },
        },
      },
    },
  },
  apis: [routesPattern, docsPattern],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
