export type UserRole = "customer" | "professional" | "business"  | "admin";

export type VerificationStatus = "Pending" | "Approved" | "Rejected";

export interface RegistrationFormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

export interface MemberData {
  userId: string;
  fullName: string;
  phone: string | null;
  role: UserRole;
  profileImage: string | null;
  profileCompletion: number;
  verificationStatus: VerificationStatus;
}