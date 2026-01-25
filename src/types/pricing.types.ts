export interface IPricingRule {
  days: "sun-wed" | "thu" | "fri" | "sat";
  timeSlot: "day" | "night";
  category: "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night";
  pricePerHour: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPricingRuleCreate {
  days: "sun-wed" | "thu" | "fri" | "sat";
  timeSlot: "day" | "night";
  category: "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night";
  pricePerHour: number;
  isActive?: boolean;
}

export interface IPricingRuleUpdate {
  days?: "sun-wed" | "thu" | "fri" | "sat";
  timeSlot?: "day" | "night";
  category?: "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night";
  pricePerHour?: number;
  isActive?: boolean;
}

export interface ITimeSlotPrice {
  startTime: Date;
  endTime: Date;
  hours: number;
  pricePerHour: number;
  totalPrice: number;
  days: "sun-wed" | "thu" | "fri" | "sat";
  category: "weekday-day" | "weekday-night" | "weekend-day" | "weekend-night";
  timeSlot: "day" | "night";
}

export interface IPriceCalculation {
  courtId: string;
  startTime: Date;
  endTime: Date;
  totalHours: number;
  breakdown: ITimeSlotPrice[];
  subtotal: number;
  discount: number;
  finalPrice: number;
  promoCode?: string;
}
