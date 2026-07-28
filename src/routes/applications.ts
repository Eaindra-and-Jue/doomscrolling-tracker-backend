import express from "express";
import { prisma } from "../db/prisma.ts";

export const router = express.Router();

/**
 * @openapi
 * /applications:
 *   get:
 *     summary: List applications
 *     responses:
 *       200:
 *         description: Returns a list of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   platform:
 *                     type: string
 *                   packageName:
 *                     type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get("/applications", async (req, res) => {
    const applications = await prisma.application.findMany({
        take: 20
    });

    res.json(applications);
});