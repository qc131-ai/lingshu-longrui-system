import cors from "cors";
import express from "express";
import path from "node:path";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { classesRouter } from "./routes/classes.js";
import { coursesRouter } from "./routes/courses.js";
import { creditsRouter } from "./routes/credits.js";
import { filesRouter } from "./routes/files.js";
import { exportsRouter, importsRouter } from "./routes/imports.js";
import { leaveMakeupRouter } from "./routes/leaveMakeup.js";
import { leavesRouter } from "./routes/leaves.js";
import { lessonRecordsRouter } from "./routes/lessonRecords.js";
import { reportsRouter } from "./routes/reports.js";
import { schedulesRouter } from "./routes/schedules.js";
import { settingsRouter } from "./routes/settings.js";
import { studentsRouter } from "./routes/students.js";
import { teachersRouter } from "./routes/teachers.js";
import { mockAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ok } from "./lib/response.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
  app.use(express.json());
  app.use("/uploads", express.static(path.resolve(process.cwd(), "backend/uploads")));
  app.use(mockAuth);

  app.get("/health", (_req, res) => ok(res, { status: "ok", service: "astralink-backend" }));
  app.get("/api/health", (_req, res) => ok(res, { status: "ok", service: "astralink-backend" }));

  app.use("/api/auth", authRouter);
  app.use("/api/students", studentsRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/classes", classesRouter);
  app.use("/api/teachers", teachersRouter);
  app.use("/api/schedules", schedulesRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/lesson-records", lessonRecordsRouter);
  app.use("/api/leave-makeup", leaveMakeupRouter);
  app.use("/api/leaves", leavesRouter);
  app.use("/api/credits", creditsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/files", filesRouter);
  app.use("/api/import", importsRouter);
  app.use("/api/imports", importsRouter);
  app.use("/api/export", exportsRouter);

  app.use(errorHandler);

  return app;
}
