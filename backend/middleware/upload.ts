// @ts-nocheck
import multer from "multer";
import fs from "fs";
import path from "path";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";
import { Request } from "express";
import { AppError } from "../utils/AppError.js";

const storage = multer.memoryStorage();

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const extname = allowedTypes.test(file.originalname.split(".").pop()?.toLowerCase() || "");
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new AppError("Only images (jpeg, jpg, png, webp) and PDFs are allowed", 400));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export async function uploadToCloudinary(file: Express.Multer.File, folder = "mymate"): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
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

  const dir = path.join(process.cwd(), "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), file.buffer);

  const base = req
    ? `${req.protocol}://${req.get("host")}`
    : process.env.BACKEND_URL || "";
  const url = base ? `${base}/uploads/${folder}/${filename}` : `/uploads/${folder}/${filename}`;
  return { url, publicId: "" };
}