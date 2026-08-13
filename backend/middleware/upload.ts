// @ts-nocheck
import multer from "multer";
import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";
import { Request } from "express";
import { AppError } from "../utils/AppError.js";
import sharp from "sharp";

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_TYPES = /jpeg|jpg|png|webp/;
const ALLOWED_MIME_TYPES = /^image\/(jpeg|jpg|png|webp)$|^application\/pdf$/;

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validate MIME type against allowed image and PDF formats
  const mimeOk = ALLOWED_MIME_TYPES.test(file.mimetype);
  if (!mimeOk) {
    return cb(new AppError("Only images (jpeg, jpg, png, webp) and PDFs are allowed", 400));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export async function uploadToCloudinary(file: Express.Multer.File, folder = "mymate"): Promise<any> {
  // Image compression pipeline (bypass for PDF documents)
  let uploadBuffer: Buffer;
  if (file.mimetype === "application/pdf") {
    uploadBuffer = file.buffer;
  } else {
    uploadBuffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
        // Only force webp format for images; PDFs keep their format
        ...(file.mimetype !== "application/pdf" ? { format: "webp" } : {}),
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(uploadBuffer);
    bufferStream.push(null);
    bufferStream.pipe(uploadStream);
  });
}

export async function deleteFromCloudinary(publicId: string) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}

export async function storeFile(file: Express.Multer.File, folder = "mymate", req: Request | null = null): Promise<{url: string, publicId: string}> {
  if (!file) return { url: "", publicId: "" };

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      const result = await uploadToCloudinary(file, folder);
      return { url: result.secure_url || result.url, publicId: result.public_id };
    } catch (err: any) {
      console.error("Cloudinary upload failed, falling back to local storage:", err.message);
    }
  }

  // Local fallback with image optimization
  let processedBuffer: Buffer;
  let filename: string;

  if (file.mimetype === "application/pdf") {
    processedBuffer = file.buffer;
    filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
  } else {
    processedBuffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  }

  const dir = path.join(process.cwd(), "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), processedBuffer);

  const base = req
    ? `${req.protocol}://${req.get("host")}`
    : process.env.BACKEND_URL || "";
  const url = base ? `${base}/uploads/${folder}/${filename}` : `/uploads/${folder}/${filename}`;
  return { url, publicId: "" };
}