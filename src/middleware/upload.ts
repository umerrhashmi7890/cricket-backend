import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary";
import { BadRequestError } from "../utils/ApiError";

// Configure Cloudinary storage (uploads directly to Cloudinary)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "cricket-courts",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, height: 800, crop: "limit" },
      { quality: "auto" },
    ],
  } as any,
});

// File filter for images only
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new BadRequestError("Only image files are allowed"), false);
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});
