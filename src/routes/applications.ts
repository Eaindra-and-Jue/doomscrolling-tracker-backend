import express from "express";
import { prisma } from "../db/prisma.ts";

export const router = express.Router();

/**
 * @openapi
 * /applications:
 *   get:
 *     summary: List applications
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Returns a list of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - data
 *                 - page
 *                 - perPage
 *                 - total
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       platform:
 *                         type: string
 *                       packageName:
 *                         type: string
 *                 page:
 *                   type: integer
 *                   minimum: 1
 *                 perPage:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 100
 *                 total:
 *                   type: integer
 *                   minimum: 0
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
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "20", 10)));
    const skip = (page - 1) * perPage;

    const [total, applications] = await Promise.all([
        prisma.application.count(),
        prisma.application.findMany({
            skip,
            take: perPage,
            orderBy: { id: "asc" }
        })
    ]);
    res.json({ data: applications, page, perPage, total });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});
