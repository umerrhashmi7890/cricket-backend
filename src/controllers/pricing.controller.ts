import { Request, Response } from "express";
import PricingRule from "../models/PricingRule";
import { IPricingRuleCreate, IPricingRuleUpdate } from "../types/pricing.types";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../utils/ApiError";
import { PricingService } from "../services/pricing.service";

// Get all pricing rules
export const getAllPricingRules = asyncHandler(
  async (req: Request, res: Response) => {
    const pricingRules = await PricingRule.find().sort({
      days: 1,
      timeSlot: 1,
    });

    res.json({
      success: true,
      count: pricingRules.length,
      data: pricingRules,
    });
  },
);

// Get single pricing rule by ID
export const getPricingRuleById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const pricingRule = await PricingRule.findById(id);

    if (!pricingRule) {
      throw new NotFoundError("Pricing rule");
    }

    res.json({
      success: true,
      data: pricingRule,
    });
  },
);

// Create new pricing rule
export const createPricingRule = asyncHandler(
  async (req: Request, res: Response) => {
    const ruleData: IPricingRuleCreate = req.body;

    // Validate required fields
    if (!ruleData.days) {
      throw new BadRequestError("Days specification is required");
    }

    if (!ruleData.timeSlot) {
      throw new BadRequestError("Time slot is required");
    }

    if (!ruleData.category) {
      throw new BadRequestError("Category is required");
    }

    if (!ruleData.pricePerHour || ruleData.pricePerHour <= 0) {
      throw new BadRequestError("Valid price per hour is required");
    }

    // Check total count (max 8 rules)
    const totalRules = await PricingRule.countDocuments();
    if (totalRules >= 8) {
      throw new BadRequestError("Maximum of 8 pricing rules allowed");
    }

    // Check if rule already exists
    const existingRule = await PricingRule.findOne({
      days: ruleData.days,
      timeSlot: ruleData.timeSlot,
    });

    if (existingRule) {
      throw new ConflictError(
        `Pricing rule for ${ruleData.days} ${ruleData.timeSlot} already exists`,
      );
    }

    const pricingRule = await PricingRule.create(ruleData);

    res.status(201).json({
      success: true,
      message: "Pricing rule created successfully",
      data: pricingRule,
    });
  },
);

// Update pricing rule
export const updatePricingRule = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: IPricingRuleUpdate = req.body;

    // If price is being updated, validate it
    if (updateData.pricePerHour !== undefined && updateData.pricePerHour <= 0) {
      throw new BadRequestError("Price per hour must be greater than 0");
    }

    const pricingRule = await PricingRule.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!pricingRule) {
      throw new NotFoundError("Pricing rule");
    }

    res.json({
      success: true,
      message: "Pricing rule updated successfully",
      data: pricingRule,
    });
  },
);

// Delete pricing rule
export const deletePricingRule = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const pricingRule = await PricingRule.findByIdAndDelete(id);

    if (!pricingRule) {
      throw new NotFoundError("Pricing rule");
    }

    res.json({
      success: true,
      message: "Pricing rule deleted successfully",
      data: pricingRule,
    });
  },
);

// Initialize default pricing rules
export const initializePricingRules = asyncHandler(
  async (req: Request, res: Response) => {
    // Check if rules already exist
    const existingRulesCount = await PricingRule.countDocuments();
    if (existingRulesCount > 0) {
      throw new BadRequestError("Pricing rules already initialized");
    }

    // Initialize 8 pricing rules as per client requirements
    const defaultRules = [
      {
        days: "sun-wed",
        timeSlot: "day",
        category: "weekday-day",
        pricePerHour: 90,
      },
      {
        days: "sun-wed",
        timeSlot: "night",
        category: "weekday-night",
        pricePerHour: 110,
      },
      {
        days: "thu",
        timeSlot: "day",
        category: "weekday-day",
        pricePerHour: 90,
      },
      {
        days: "thu",
        timeSlot: "night",
        category: "weekend-night",
        pricePerHour: 135,
      },
      {
        days: "fri",
        timeSlot: "day",
        category: "weekend-day",
        pricePerHour: 110,
      },
      {
        days: "fri",
        timeSlot: "night",
        category: "weekend-night",
        pricePerHour: 135,
      },
      {
        days: "sat",
        timeSlot: "day",
        category: "weekend-day",
        pricePerHour: 110,
      },
      {
        days: "sat",
        timeSlot: "night",
        category: "weekday-night",
        pricePerHour: 110,
      },
    ];

    const createdRules = await PricingRule.insertMany(defaultRules);

    res.status(201).json({
      success: true,
      message: "Default pricing rules initialized successfully",
      data: createdRules,
    });
  },
);

// Seed pricing rules (Development endpoint - deletes existing and creates fresh)
export const seedPricingRules = asyncHandler(
  async (req: Request, res: Response) => {
    // Delete all existing rules first
    await PricingRule.deleteMany({});

    // Create 8 default pricing rules
    const defaultRules = [
      {
        days: "sun-wed",
        timeSlot: "day",
        category: "weekday-day",
        pricePerHour: 90,
      },
      {
        days: "sun-wed",
        timeSlot: "night",
        category: "weekday-night",
        pricePerHour: 110,
      },
      {
        days: "thu",
        timeSlot: "day",
        category: "weekday-day",
        pricePerHour: 90,
      },
      {
        days: "thu",
        timeSlot: "night",
        category: "weekend-night",
        pricePerHour: 135,
      },
      {
        days: "fri",
        timeSlot: "day",
        category: "weekend-day",
        pricePerHour: 110,
      },
      {
        days: "fri",
        timeSlot: "night",
        category: "weekend-night",
        pricePerHour: 135,
      },
      {
        days: "sat",
        timeSlot: "day",
        category: "weekend-day",
        pricePerHour: 110,
      },
      {
        days: "sat",
        timeSlot: "night",
        category: "weekday-night",
        pricePerHour: 110,
      },
    ];

    const createdRules = await PricingRule.insertMany(defaultRules);

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${createdRules.length} pricing rules`,
      data: createdRules,
    });
  },
);

// Calculate price for booking (public endpoint)
export const calculatePrice = asyncHandler(
  async (req: Request, res: Response) => {
    const { bookingDate, startTime, endTime } = req.body;

    if (!bookingDate || !startTime || !endTime) {
      throw new BadRequestError(
        "Booking date, start time, and end time are required",
      );
    }

    const result = await PricingService.calculateBookingPrice(
      bookingDate,
      startTime,
      endTime,
    );

    res.json({
      success: true,
      data: result,
    });
  },
);

// Get current pricing (public endpoint for customers)
export const getCurrentPricing = asyncHandler(
  async (req: Request, res: Response) => {
    const pricingRules = await PricingRule.find().sort({
      days: 1,
      timeSlot: 1,
    });

    // Format into a simple structure for frontend
    const pricing = {
      weekdayDayRate: 0,
      weekdayNightRate: 0,
      weekendDayRate: 0,
      weekendNightRate: 0,
    };

    pricingRules.forEach((rule) => {
      // Get weekday day rate (Sun-Wed or Thu day)
      if (rule.category === "weekday-day" && pricing.weekdayDayRate === 0) {
        pricing.weekdayDayRate = rule.pricePerHour;
      }
      // Get weekday night rate (Sun-Wed night or Sat night)
      else if (
        rule.category === "weekday-night" &&
        pricing.weekdayNightRate === 0
      ) {
        pricing.weekdayNightRate = rule.pricePerHour;
      }
      // Get weekend day rate (Fri or Sat day)
      else if (
        rule.category === "weekend-day" &&
        pricing.weekendDayRate === 0
      ) {
        pricing.weekendDayRate = rule.pricePerHour;
      }
      // Get weekend night rate (Thu or Fri night)
      else if (
        rule.category === "weekend-night" &&
        pricing.weekendNightRate === 0
      ) {
        pricing.weekendNightRate = rule.pricePerHour;
      }
    });

    res.json({
      success: true,
      data: pricing,
    });
  },
);
