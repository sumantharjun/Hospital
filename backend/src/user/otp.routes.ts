import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "./user.model";
import { JWT_SECRET } from "../config";
import { ROLE_PERMISSIONS, PharmacyRole } from "./pharmacyRoles";
import {
  OTP_EXPIRES_IN_SECONDS,
  issueOtp,
  normalizePhone,
  verifyOtp,
} from "../shared/services/otp.service";


/**
 * Send OTP to phone (for pharmacy multi-login)
 * POST /api/users/otp/send { "phone": "9876543210" }
 */
export const router = Router();

router.post("/send", async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length < 10) {
      return res.status(400).json({ message: "Valid 10-digit phone number is required" });
    }

    // Find user with this phone and pharmacy role (phone may be stored with or without country code)
    const user = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: { $regex: normalizedPhone + "$" } },
      ],
      role: "PHARMACY_STAFF",
      isActive: true,
    });

    if (!user) {
      // Don't reveal that phone doesn't exist - still return success for security
      return res.json({
        message: "If this number is registered, you will receive an OTP shortly",
        expiresIn: OTP_EXPIRES_IN_SECONDS,
      });
    }

    const issued = await issueOtp(normalizedPhone);
    if (!issued) {
      return res.status(503).json({
        message: "OTP delivery is not available. Please contact your administrator.",
      });
    }

    res.json({
      message: "If this number is registered, you will receive an OTP shortly",
      expiresIn: OTP_EXPIRES_IN_SECONDS,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to send OTP" });
  }
});

/**
 * Verify OTP and login
 * POST /api/users/otp/verify { "phone": "9876543210", "otp": "123456" }
 */
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length < 10) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    const result = verifyOtp(normalizedPhone, otp);
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    let user = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { phone: { $regex: normalizedPhone + "$" } },
      ],
      role: "PHARMACY_STAFF",
      isActive: true,
    }).select("-passwordHash");

    if (!user) {
      const inactiveUser = await User.findOne({
        $or: [
          { phone: normalizedPhone },
          { phone: { $regex: normalizedPhone + "$" } },
        ],
        role: "PHARMACY_STAFF",
      }).select("isActive");
      if (inactiveUser) {
        return res.status(403).json({
          message: "This pharmacy account is inactive. Please contact admin to activate the pharmacy, then try again.",
        });
      }
      return res.status(401).json({ message: "User not found or inactive" });
    }

    const token = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const branchRole = (user as any).pharmacyBranchRole || "PHARMACY_STAFF";
    const permissions = ROLE_PERMISSIONS[branchRole as PharmacyRole] || [];

    res.json({
      token,
      user: {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        pharmacyId: user.pharmacyId,
        phone: user.phone,
        pharmacyBranchRole: branchRole,
        permissions,
        isActive: user.isActive,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to verify OTP" });
  }
});
