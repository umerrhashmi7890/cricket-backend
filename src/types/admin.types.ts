import { Request } from "express";

export interface IAdmin {
  username: string;
  email: string;
  password: string;
  role: "super_admin" | "admin";
  isActive: boolean;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAdminCreate {
  username: string;
  email: string;
  password: string;
  role?: "super_admin" | "admin";
}

export interface IAdminLogin {
  username: string;
  password: string;
}

export interface IAdminResponse {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface IAuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
    email: string;
    role: string;
  };
}
