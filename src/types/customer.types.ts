export interface ICustomer {
  name: string;
  phone: string;
  email?: string;
  totalBookings: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICustomerCreate {
  name: string;
  phone: string;
  email?: string;
}

export interface ICustomerUpdate {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ICustomerResponse {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalBookings: number;
  createdAt: Date;
  updatedAt: Date;
}
