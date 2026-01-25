import { Request, Response } from "express";
import PromoCode from "../models/PromoCode";
import { IPromoCodeCreate, IPromoCodeUpdate, ValidatePromoCodeDTO } from "../types/promoCode.types";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../utils/ApiError";
import { PromoCodeService } from "../services/promoCode.service";

/**
 * Validate promo code (public endpoint)
 * Used during booking flow to check if code is valid
 * Uses customer phone for validation (supports guest bookings)
 */
export const validatePromoCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, customerPhone, bookingAmount } = req.body as ValidatePromoCodeDTO;

    if (!code || !customerPhone || !bookingAmount) {
      throw new BadRequestError("Code, customer phone, and booking amount are required");
    }

    const result = await PromoCodeService.validatePromoCode(
      code,
      customerPhone,
      bookingAmount
    );

    res.json({
      success: result.valid,
      data: result,
      message: result.message,
    });
  }
);

/**
 * Get all promo codes (admin only)
 */
export const getAllPromoCodes = asyncHandler(
  async (req: Request, res: Response) => {
    const { isActive, includeExpired } = req.query;

    const filter: any = {};

    // Filter by active status
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    // Filter out expired codes by default
    if (includeExpired !== "true") {
      filter.expiresAt = { $gt: new Date() };
    }

    const promoCodes = await PromoCode.find(filter).sort({ createdAt: -1 });

    // Add computed fields
    const promoCodesWithStats = promoCodes.map((code) => ({
      _id: code._id,
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      maxTotalUses: code.maxTotalUses,
      usageCount: code.usedByCustomers.length,
      remainingUses:
        code.maxTotalUses !== null
          ? code.maxTotalUses - code.usedByCustomers.length
          : null,
      isActive: code.isActive,
      isExpired: new Date() > code.expiresAt,
      expiresAt: code.expiresAt,
      createdAt: code.createdAt,
      updatedAt: code.updatedAt,
    }));

    res.json({
      success: true,
      count: promoCodesWithStats.length,
      data: promoCodesWithStats,
    });
  }
);

/**
 * Get single promo code by ID (admin only)
 */
export const getPromoCodeById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      throw new NotFoundError("Promo code");
    }

    res.json({
      success: true,
      data: {
        _id: promoCode._id,
        code: promoCode.code,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        maxTotalUses: promoCode.maxTotalUses,
        usageCount: promoCode.usedByCustomers.length,
        usedByCustomers: promoCode.usedByCustomers,
        remainingUses:
          promoCode.maxTotalUses !== null
            ? promoCode.maxTotalUses - promoCode.usedByCustomers.length
            : null,
        isActive: promoCode.isActive,
        isExpired: new Date() > promoCode.expiresAt,
        expiresAt: promoCode.expiresAt,
        createdAt: promoCode.createdAt,
        updatedAt: promoCode.updatedAt,
      },
    });
  }
);

/**
 * Create new promo code (admin only)
 */
export const createPromoCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { code, discountType, discountValue, maxTotalUses, expiry } =
      req.body as IPromoCodeCreate;

    // Validate required fields
    if (!code || !discountType || discountValue === undefined) {
      throw new BadRequestError("Code, discount type, and discount value are required");
    }

    // Validate discount value
    if (discountValue <= 0) {
      throw new BadRequestError("Discount value must be greater than 0");
    }

    if (discountType === "percentage" && discountValue > 100) {
      throw new BadRequestError("Percentage discount cannot exceed 100%");
    }

    // Check for duplicate code
    const existingCode = await PromoCode.findOne({
      code: code.toUpperCase(),
    });

    if (existingCode) {
      throw new ConflictError("Promo code already exists");
    }

    // Calculate expiry date based on provided days (default: 7 days)
    const expiryDays = expiry && expiry > 0 ? expiry : 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Create promo code
    const promoCode = await PromoCode.create({
      code: code.toUpperCase(),
      discountType,
      discountValue,
      maxTotalUses: maxTotalUses || null,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      data: promoCode,
      message: "Promo code created successfully",
    });
  }
);

/**
 * Update promo code (admin only)
 */
export const updatePromoCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body as IPromoCodeUpdate;

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      throw new NotFoundError("Promo code");
    }

    // Validate discount value if provided
    if (updates.discountValue !== undefined && updates.discountValue <= 0) {
      throw new BadRequestError("Discount value must be greater than 0");
    }

    // Validate percentage discount
    if (
      updates.discountType === "percentage" &&
      updates.discountValue !== undefined &&
      updates.discountValue > 100
    ) {
      throw new BadRequestError("Percentage discount cannot exceed 100%");
    }

    // Check for duplicate code if updating code
    if (updates.code && updates.code !== promoCode.code) {
      const existingCode = await PromoCode.findOne({
        code: updates.code.toUpperCase(),
      });
      if (existingCode) {
        throw new ConflictError("Promo code already exists");
      }
      updates.code = updates.code.toUpperCase();
    }

    // Update fields
    Object.assign(promoCode, updates);
    await promoCode.save();

    res.json({
      success: true,
      data: promoCode,
      message: "Promo code updated successfully",
    });
  }
);

/**
 * Toggle promo code active status (admin only)
 */
export const togglePromoCodeStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      throw new NotFoundError("Promo code");
    }

    promoCode.isActive = !promoCode.isActive;
    await promoCode.save();

    res.json({
      success: true,
      data: promoCode,
      message: `Promo code ${promoCode.isActive ? "activated" : "deactivated"} successfully`,
    });
  }
);

/**
 * Delete promo code (admin only)
 */
export const deletePromoCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      throw new NotFoundError("Promo code");
    }

    // Check if promo code has been used
    if (promoCode.usedByCustomers.length > 0) {
      throw new BadRequestError(
        "Cannot delete promo code that has been used. Deactivate it instead."
      );
    }

    await PromoCode.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Promo code deleted successfully",
    });
  }
);
