import { Request, Response } from "express";
import Court from "../models/Court";
import { ICourtCreate, ICourtUpdate } from "../types/court.types";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../utils/ApiError";
import cloudinary from "../config/cloudinary";

// Get all courts
export const getAllCourts = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.query;

    const filter: any = {};
    if (
      status &&
      ["active", "inactive", "maintenance"].includes(status as string)
    ) {
      filter.status = status;
    }

    const courts = await Court.find(filter).sort({ createdAt: 1 });

    res.json({
      success: true,
      count: courts.length,
      data: courts,
    });
  },
);

// Get single court by ID
export const getCourtById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const court = await Court.findById(id);

    if (!court) {
      throw new NotFoundError("Court");
    }

    res.json({
      success: true,
      data: court,
    });
  },
);

// Create new court
export const createCourt = asyncHandler(async (req: Request, res: Response) => {
  const courtData: ICourtCreate = req.body;

  // Handle features parsing (comes as string from form-data)
  if (courtData.features && typeof courtData.features === "string") {
    try {
      courtData.features = JSON.parse(courtData.features);
    } catch (error) {
      throw new BadRequestError(
        "Invalid features format. Must be a valid JSON array",
      );
    }
  }

  // Validate required fields before uploading image
  if (!courtData.name || !courtData.name.trim()) {
    throw new BadRequestError("Court name is required");
  }

  if (!courtData.description || !courtData.description.trim()) {
    throw new BadRequestError("Court description is required");
  }

  // Check court count limit (max 7 courts)
  const courtCount = await Court.countDocuments();
  if (courtCount >= 7) {
    throw new BadRequestError("Maximum court limit reached (7 courts)");
  }

  // Check if court name already exists
  const existingCourt = await Court.findOne({ name: courtData.name });
  if (existingCourt) {
    throw new ConflictError("Court with this name already exists");
  }

  // Get Cloudinary URL (already uploaded via CloudinaryStorage)
  if (req.file) {
    courtData.imageUrl = (req.file as any).path;
  }

  const court = await Court.create(courtData);

  res.status(201).json({
    success: true,
    message: "Court created successfully",
    data: court,
  });
});

// Update court
export const updateCourt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData: ICourtUpdate = req.body;

  // Handle features parsing (comes as string from form-data)
  if (updateData.features && typeof updateData.features === "string") {
    try {
      updateData.features = JSON.parse(updateData.features);
    } catch (error) {
      throw new BadRequestError(
        "Invalid features format. Must be a valid JSON array",
      );
    }
  }

  // If name is being updated, validate and check duplicates
  if (updateData.name) {
    if (!updateData.name.trim()) {
      throw new BadRequestError("Court name cannot be empty");
    }

    const existingCourt = await Court.findOne({
      name: updateData.name,
      _id: { $ne: id },
    });

    if (existingCourt) {
      throw new ConflictError("Court with this name already exists");
    }
  }

  // If description is being updated, validate it
  if (updateData.description !== undefined && !updateData.description.trim()) {
    throw new BadRequestError("Court description cannot be empty");
  }

  if (req.file) {
    // Get the old court to delete old image from Cloudinary
    const oldCourt = await Court.findById(id);

    if (oldCourt && oldCourt.imageUrl) {
      // Extract public_id from old Cloudinary URL
      const urlParts = oldCourt.imageUrl.split("/");
      const publicIdWithExtension = urlParts[urlParts.length - 1];
      const publicId = `cricket-courts/${publicIdWithExtension.split(".")[0]}`;

      try {
        // Delete old image from Cloudinary
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error("Error deleting old image from Cloudinary:", error);
        // Continue even if deletion fails
      }
    }

    // Set new image URL from uploaded file
    updateData.imageUrl = (req.file as any).path;
  }

  const court = await Court.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  if (!court) {
    throw new NotFoundError("Court");
  }

  res.json({
    success: true,
    message: "Court updated successfully",
    data: court,
  });
});

// Archive court (soft delete)
export const deleteCourt = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const court = await Court.findByIdAndUpdate(
    id,
    { status: "archived" },
    { new: true },
  );

  if (!court) {
    throw new NotFoundError("Court");
  }

  res.json({
    success: true,
    message: "Court archived successfully",
    data: court,
  });
});

// Toggle court status
export const toggleCourtStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive", "maintenance", "archived"].includes(status)) {
      throw new BadRequestError(
        "Invalid status. Must be: active, inactive, maintenance, or archived",
      );
    }

    const court = await Court.findByIdAndUpdate(id, { status }, { new: true });

    if (!court) {
      throw new NotFoundError("Court");
    }

    res.json({
      success: true,
      message: `Court status changed to ${status}`,
      data: court,
    });
  },
);

// Seed 7 courts (Development endpoint)
export const seedCourts = asyncHandler(async (req: Request, res: Response) => {
  // Delete all existing courts first
  await Court.deleteMany({});

  const courtsData = [
    {
      name: "Court 1",
      description:
        "Premium cricket net with professional-grade facilities and excellent lighting for day and night sessions.",
      status: "active",
      features: [
        "Professional Turf",
        "LED Floodlights",
        "Bowling Machine",
        "Video Analysis",
        "Climate Controlled",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&h=600&fit=crop",
    },
    {
      name: "Court 2",
      description:
        "High-quality practice court with advanced bowling machine and video recording facilities.",
      status: "active",
      features: [
        "Synthetic Turf",
        "LED Lights",
        "Bowling Machine",
        "Sound System",
        "Water Dispenser",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=800&h=600&fit=crop",
    },
    {
      name: "Court 3",
      description:
        "Standard cricket practice facility perfect for individual training and small group sessions.",
      status: "active",
      features: [
        "Quality Turf",
        "Good Lighting",
        "Equipment Storage",
        "Seating Area",
        "Wi-Fi",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&h=600&fit=crop",
    },
    {
      name: "Court 4",
      description:
        "Modern cricket net with excellent facilities for batting practice and technique improvement.",
      status: "active",
      features: [
        "Premium Surface",
        "Bright Lighting",
        "Training Equipment",
        "First Aid Kit",
        "Changing Room Access",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1593766787879-e8c78e09cec4?w=800&h=600&fit=crop",
    },
    {
      name: "Court 5",
      description:
        "Well-maintained practice court suitable for all skill levels with comfortable amenities.",
      status: "active",
      features: [
        "Good Turf Quality",
        "LED Lighting",
        "Practice Equipment",
        "Cooling System",
        "Parking Nearby",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&h=600&fit=crop",
    },
    {
      name: "Court 6",
      description:
        "Spacious cricket net with modern facilities ideal for coaching sessions and team practice.",
      status: "active",
      features: [
        "Large Practice Area",
        "Excellent Lighting",
        "Coaching Board",
        "Spectator Seating",
        "Refreshments Available",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1512719994953-eabf50895df7?w=800&h=600&fit=crop",
    },
    {
      name: "Court 7",
      description:
        "Top-tier cricket practice facility with state-of-the-art equipment and premium amenities.",
      status: "active",
      features: [
        "Premium Facilities",
        "Advanced Lighting",
        "Professional Equipment",
        "VIP Lounge Access",
        "Complimentary Drinks",
      ],
      imageUrl:
        "https://images.unsplash.com/photo-1546608235-3310a2494cdf?w=800&h=600&fit=crop",
    },
  ];

  const courts = await Court.insertMany(courtsData);

  res.status(201).json({
    success: true,
    message: `Successfully seeded ${courts.length} courts`,
    data: courts,
  });
});
