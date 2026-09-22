import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

export const router = Router();

import { uploadDir as uploadDirFor } from "../shared/uploads";

// Ensure both categories exist up front so static serving never 404s on the dir.
uploadDirFor("prescriptions");
uploadDirFor("products");

function storageFor(category: string, prefix: string) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDirFor(category));
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
  });
}

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images and PDFs
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only image and PDF files are allowed"));
  }
};

const LIMITS = { fileSize: 5 * 1024 * 1024 }; // 5MB

const uploadPrescription = multer({
  storage: storageFor("prescriptions", "prescription"),
  limits: LIMITS,
  fileFilter,
});

const uploadProduct = multer({
  storage: storageFor("products", "product"),
  limits: LIMITS,
  fileFilter,
});

/**
 * Upload prescription image/PDF
 */
router.post("/prescription", uploadPrescription.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // In production, upload to cloud storage (AWS S3, Cloudinary, etc.)
    // For now, return the local file path
    const fileUrl = `/uploads/prescriptions/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${fileUrl}`;

    res.json({
      success: true,
      url: fullUrl,
      fileUrl: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to upload file" });
  }
});

/**
 * Upload product image
 */
router.post("/product", uploadProduct.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileUrl = `/uploads/products/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get("host")}${fileUrl}`;

    res.json({
      success: true,
      url: fullUrl,
      fileUrl: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || "Failed to upload file" });
  }
});

