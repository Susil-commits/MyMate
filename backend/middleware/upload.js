import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|pdf/;
  const extname = allowedTypes.test(file.originalname.split(".").pop().toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpeg, jpg, png, webp) and PDFs are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export async function uploadToCloudinary(file, folder = "mymate") {
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

export async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err);
  }
}