import express from "express";
import { prisma } from "../db/prisma.ts";

export const router = express.Router();

router.get("/applications", async (req, res) => {
    const applications = await prisma.application.findMany({
        take: 20
    });

    res.json(applications);
});