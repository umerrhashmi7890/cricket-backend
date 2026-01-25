export interface ICourt {
  name: string;
  description?: string;
  status: "active" | "inactive" | "maintenance";
  features: string[];
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICourtCreate {
  name: string;
  description?: string;
  features?: string[];
  imageUrl?: string;
}

export interface ICourtUpdate {
  name?: string;
  description?: string;
  status?: "active" | "inactive" | "maintenance";
  features?: string[];
  imageUrl?: string;
}
