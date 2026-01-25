import { Request, Response } from "express";
import Customer from "../models/Customer";
import { ICustomerCreate, ICustomerUpdate } from "../types/customer.types";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../utils/ApiError";

// Get all customers
export const getAllCustomers = asyncHandler(
  async (req: Request, res: Response) => {
    const { search } = req.query;

    const filter: any = {};

    // Search by name or phone
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const customers = await Customer.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: customers.length,
      data: customers,
    });
  }
);

// Get single customer by ID
export const getCustomerById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findById(id);

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    res.json({
      success: true,
      data: customer,
    });
  }
);

// Get customer by phone (for booking flow)
export const getCustomerByPhone = asyncHandler(
  async (req: Request, res: Response) => {
    const { phone } = req.params;

    const customer = await Customer.findOne({ phone });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    res.json({
      success: true,
      data: customer,
    });
  }
);

// Create new customer (used during booking)
export const createCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const customerData: ICustomerCreate = req.body;

    // Validate required fields
    if (!customerData.name || !customerData.name.trim()) {
      throw new BadRequestError("Customer name is required");
    }

    if (!customerData.phone || !customerData.phone.trim()) {
      throw new BadRequestError("Phone number is required");
    }

    // Check if customer with phone already exists
    const existingCustomer = await Customer.findOne({
      phone: customerData.phone,
    });

    if (existingCustomer) {
      throw new ConflictError("Customer with this phone number already exists");
    }

    const customer = await Customer.create(customerData);

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: customer,
    });
  }
);

// Find or create customer (helper for booking flow)
export const findOrCreateCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, phone, email } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      throw new BadRequestError("Customer name is required");
    }

    if (!phone || !phone.trim()) {
      throw new BadRequestError("Phone number is required");
    }

    // Try to find existing customer
    let customer = await Customer.findOne({ phone });

    if (!customer) {
      // Create new customer
      customer = await Customer.create({ name, phone, email });
    }

    res.json({
      success: true,
      data: customer,
      isNew: !customer,
    });
  }
);

// Update customer
export const updateCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData: ICustomerUpdate = req.body;

    // If phone is being updated, check for duplicates
    if (updateData.phone) {
      if (!updateData.phone.trim()) {
        throw new BadRequestError("Phone number cannot be empty");
      }

      const existingCustomer = await Customer.findOne({
        phone: updateData.phone,
        _id: { $ne: id },
      });

      if (existingCustomer) {
        throw new ConflictError(
          "Customer with this phone number already exists"
        );
      }
    }

    // If name is being updated, validate it
    if (updateData.name !== undefined && !updateData.name.trim()) {
      throw new BadRequestError("Customer name cannot be empty");
    }

    const customer = await Customer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    res.json({
      success: true,
      message: "Customer updated successfully",
      data: customer,
    });
  }
);

// Delete customer
export const deleteCustomer = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const customer = await Customer.findByIdAndDelete(id);

    if (!customer) {
      throw new NotFoundError("Customer");
    }

    res.json({
      success: true,
      message: "Customer deleted successfully",
      data: customer,
    });
  }
);
