import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { created, ok } from "../lib/response.js";
import { badRequest } from "../lib/errors.js";
import { uploadFileSchema } from "../validators/schemas.js";
import { logOperation } from "../lib/operationLog.js";
import { requireRoles } from "../middleware/auth.js";

const uploadDir = path.resolve(process.cwd(), "backend/uploads");
mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const filesRouter = Router();

filesRouter.post(
  "/upload",
  requireRoles("admin", "academic_manager", "advisor", "teacher", "finance"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest("file is required");
    const input = uploadFileSchema.parse(req.body);

    const file = await prisma.uploadedFile.create({
      data: {
        organizationId: req.user.organizationId,
        uploadedBy: req.user.id,
        studentId: input.studentId,
        lessonRecordId: input.lessonRecordId,
        parentReportId: input.parentReportId,
        category: input.category,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
      },
    });

    await logOperation(req, {
      action: "upload_file",
      resourceType: "uploaded_file",
      resourceId: file.id,
      detail: { category: input.category, originalName: req.file.originalname },
    });

    return created(res, file);
  })
);

filesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const files = await prisma.uploadedFile.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { createdAt: "desc" },
    });
    return ok(res, files);
  })
);
