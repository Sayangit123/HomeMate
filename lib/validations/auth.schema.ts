import * as yup from "yup";

export const authSchema = yup.object({
  fullName: yup
    .string()
    .required("Full name is required")
    .min(3, "Full name must be at least 3 characters")
    .max(100, "Full name must not exceed 100 characters")
    .matches(
      /^[A-Za-z]+(?:\s+[A-Za-z]+)+$/,
      "Please enter your first and last name"
    ),

  email: yup
    .string()
    .required("Email is required")
    .email("Please enter a valid email address"),

  phone: yup
    .string()
    .required("Phone number is required")
    .matches(
      /^[6-9]\d{9}$/,
      "Please enter a valid 10-digit phone number"
    ),

  password: yup
    .string()
    .required("Password is required")
    .min(8, "Password must be at least 8 characters")
    .matches(
      /[A-Z]/,
      "Password must contain at least one uppercase letter"
    )
    .matches(
      /[a-z]/,
      "Password must contain at least one lowercase letter"
    )
    .matches(
      /[0-9]/,
      "Password must contain at least one number"
    )
    .matches(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),

  confirmPassword: yup
    .string()
    .required("Please confirm your password")
    .oneOf([yup.ref("password")], "Passwords do not match"),

  role: yup
    .mixed<"customer" | "professional" | "business">()
    .oneOf(
      ["customer", "professional", "business"],
      "Please select a valid role"
    )
    .required("Please select your role"),
});