import { Router, Request, Response } from "express";
import { Appointment } from "../appointment/appointment.model";
import { Order } from "../order/order.model";
import { FinanceEntry } from "../finance/finance.model";
import { InventoryItem } from "../inventory/inventory.model";
import { Prescription } from "../prescription/prescription.model";
import { User } from "../user/user.model";
import { Hospital } from "../master/hospital.model";
import { Pharmacy } from "../master/pharmacy.model";
import { AggregationService } from "../shared/services/aggregation.service";
import { DoctorSchedule, Slot } from "../schedule/schedule.model";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import {
  OTP_EXPIRES_IN_SECONDS,
  issueOtp,
  normalizePhone,
  verifyOtp,
} from "../shared/services/otp.service";

export const router = Router();

router.post("/otp/send", async (req: Request, res: Response) => {
  try {
    const normalizedPhone = normalizePhone(req.body?.phone);

    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Valid 10-digit phone number is required",
      });
    }

    const issued = await issueOtp(normalizedPhone);
    if (!issued) {
      return res.status(503).json({
        success: false,
        message: "OTP delivery is not available. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
      expiresIn: OTP_EXPIRES_IN_SECONDS,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
});

// Verify OTP and login
router.post("/otp/verify", async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone.length !== 10 || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const result = verifyOtp(normalizedPhone, otp);
    if (!result.ok) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    // OTP verified - find or create user
    // Match stored numbers that carry a country code too (e.g. +919876543210),
    // otherwise a returning patient gets a duplicate record. Mirrors the
    // lookup in user/otp.routes.ts.
    let user = await User.findOne({
      $or: [
        { phone: normalizedPhone },
        { phoneNumber: normalizedPhone },
        { phone: { $regex: normalizedPhone + "$" } },
        { phoneNumber: { $regex: normalizedPhone + "$" } },
      ],
      role: "PATIENT"
    });

    if (!user) {
      // Create new patient user
      // Generate a random password hash (user won't use it for OTP login)
      const bcrypt = await import("bcryptjs");
      const defaultPasswordHash = await bcrypt.hash(normalizedPhone + Date.now(), 10);
      
      user = await User.create({
        name: `Patient ${normalizedPhone}`,
        email: `${normalizedPhone}@patient.local`, // Temporary email
        passwordHash: defaultPasswordHash,
        role: "PATIENT",
        phone: normalizedPhone,
        isActive: true,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userResponse: any = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
    };

    res.json({
      success: true,
      token,
      user: userResponse,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
});

/**
 * PUBLIC API ROUTES
 * These endpoints are accessible without authentication
 * Rate limiting and validation should be applied in production
 */

// Health check
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Government Medical Platform API",
    version: "1.0.0",
  });
});

// Get public hospitals list
router.get("/hospitals", async (_req: Request, res: Response) => {
  try {
    const hospitals = await Hospital.find({ isActive: true })
      .select("name address phone")
      .limit(100)
      .lean();
    res.json({
      success: true,
      data: hospitals,
      count: hospitals.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch hospitals",
      error: error.message,
    });
  }
});

// Get public pharmacies list
router.get("/pharmacies", async (_req: Request, res: Response) => {
  try {
    const pharmacies = await Pharmacy.find({ isActive: true })
      .select("name address phone")
      .limit(100)
      .lean();
    res.json({
      success: true,
      data: pharmacies,
      count: pharmacies.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch pharmacies",
      error: error.message,
    });
  }
});

// Search doctors (public)
router.get("/doctors", async (req: Request, res: Response) => {
  try {
    const { search, hospitalId, limit = 20 } = req.query;
    
    const filter: any = {
      role: "DOCTOR",
      isActive: true,
    };
    
    // Filter by hospitalId if provided
    if (hospitalId) {
      filter.hospitalId = hospitalId;
    }
    
    // Add search filter if search parameter is provided
    if (search && typeof search === "string" && search.trim()) {
      const searchTerm = search.trim();
      // Check if search is a valid MongoDB ObjectId (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(searchTerm);
      
      if (isValidObjectId) {
        // If it's an ObjectId, search by _id first
        filter.$or = [
          { _id: searchTerm },
          { name: { $regex: searchTerm, $options: "i" } },
          { specialization: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
        ];
      } else {
        // Use regex search (works without text index)
        filter.$or = [
          { name: { $regex: searchTerm, $options: "i" } },
          { specialization: { $regex: searchTerm, $options: "i" } },
          { email: { $regex: searchTerm, $options: "i" } },
        ];
      }
    }
    
    const doctors = await User.find(filter)
      .select("_id name email phone hospitalId specialization qualification serviceCharge")
      .limit(Number(limit))
      .lean();
    
    // Format doctors to include _id as id
    const formattedDoctors = doctors.map((doctor: any) => ({
      _id: doctor._id.toString(),
      id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      hospitalId: doctor.hospitalId || undefined,
      specialization: doctor.specialization || undefined,
      qualification: doctor.qualification || undefined,
      serviceCharge: doctor.serviceCharge || undefined,
    }));

    console.log(`[Doctors] Found ${formattedDoctors.length} doctors for hospitalId: ${hospitalId || 'all'}`);

    res.json({
      success: true,
      data: formattedDoctors,
      count: formattedDoctors.length,
    });
  } catch (error: any) {
    console.error("[Doctors] Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search doctors",
      error: error.message,
    });
  }
});

// Search medicines (public - inventory search)
router.get("/medicines", async (req: Request, res: Response) => {
  try {
    const { search, pharmacyId, limit = 50 } = req.query;
    
    const filter: any = {};
    
    if (pharmacyId) {
      filter.pharmacyId = pharmacyId;
    }
    
    if (search) {
      filter.$text = { $search: search as string };
    }
    
    const medicines = await InventoryItem.find(filter)
      .select("medicineName batchNumber quantity expiryDate pharmacyId")
      .limit(Number(limit))
      .lean();
    
    res.json({
      success: true,
      data: medicines,
      count: medicines.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to search medicines",
      error: error.message,
    });
  }
});

// Get appointments with details using aggregation (public - with filters)
router.get("/appointments", async (req: Request, res: Response) => {
  try {
    const filters = {
      patientId: req.query.patientId as string,
      doctorId: req.query.doctorId as string,
      hospitalId: req.query.hospitalId as string,
      status: req.query.status as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
    };
    
    const pipeline = AggregationService.getAppointmentsWithDetails(filters);
    const appointments = await Appointment.aggregate(pipeline as any[]);
    
    res.json({
      success: true,
      data: appointments,
      count: appointments.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
});

// Get orders with details using aggregation (public - with filters)
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const filters = {
      patientId: req.query.patientId as string,
      pharmacyId: req.query.pharmacyId as string,
      status: req.query.status as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
    };
    
    const pipeline = AggregationService.getOrdersWithDetails(filters);
    const orders = await Order.aggregate(pipeline as any[]);
    
    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
});

// Get finance summary using aggregation (public - aggregated data)
router.get("/finance/summary", async (req: Request, res: Response) => {
  try {
    const filters = {
      hospitalId: req.query.hospitalId as string,
      pharmacyId: req.query.pharmacyId as string,
      type: req.query.type as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
    };
    
    const pipeline = AggregationService.getFinanceAggregated(filters);
    const financeData = await FinanceEntry.aggregate(pipeline as any[]);
    
    res.json({
      success: true,
      data: financeData,
      count: financeData.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch finance summary",
      error: error.message,
    });
  }
});

// Get inventory with alerts using aggregation (public)
router.get("/inventory", async (req: Request, res: Response) => {
  try {
    const filters = {
      pharmacyId: req.query.pharmacyId as string,
      medicineName: req.query.medicineName as string,
      lowStockOnly: req.query.lowStockOnly === "true",
    };
    
    const pipeline = AggregationService.getInventoryWithAlerts(filters);
    const inventory = await InventoryItem.aggregate(pipeline as any[]);
    
    res.json({
      success: true,
      data: inventory,
      count: inventory.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
});

// Get prescriptions with details (public - with filters)
router.get("/prescriptions", async (req: Request, res: Response) => {
  try {
    const filters = {
      patientId: req.query.patientId as string,
      doctorId: req.query.doctorId as string,
      prescriptionId: req.query.prescriptionId as string,
    };
    
    const pipeline = AggregationService.getPrescriptionsWithDetails(filters);
    const prescriptions = await Prescription.aggregate(pipeline as any[]);
    
    res.json({
      success: true,
      data: prescriptions,
      count: prescriptions.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: error.message,
    });
  }
});

// Get doctor schedules (public - for patient portal)
router.get("/doctor-schedules", async (req: Request, res: Response) => {
  try {
    const { doctorId, hospitalId } = req.query;
    const filter: any = { isActive: true };
    
    if (doctorId) filter.doctorId = doctorId;
    if (hospitalId) filter.hospitalId = hospitalId;
    
    const schedules = await DoctorSchedule.find(filter)
      .sort({ doctorId: 1, dayOfWeek: 1 })
      .lean();
    
    res.json({
      success: true,
      data: schedules,
      count: schedules.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctor schedules",
      error: error.message,
    });
  }
});

// Get available slots for a doctor (public - for patient portal)
router.get("/doctor-slots", async (req: Request, res: Response) => {
  try {
    const { doctorId, date, hospitalId } = req.query;
    
    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: "doctorId and date are required",
      });
    }
    
    const slotDate = new Date(date as string);
    if (isNaN(slotDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }
    
    slotDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(slotDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const filter: any = {
      doctorId,
      date: { $gte: slotDate, $lt: nextDay },
      isBlocked: false,
    };
    
    if (hospitalId) filter.hospitalId = hospitalId;
    
    const slots = await Slot.find(filter)
      .sort({ startTime: 1 })
      .lean();
    
    // Filter out fully booked slots
    const availableSlots = slots.filter((slot: any) => {
      return slot.bookedCount < slot.maxBookings;
    });
    
    res.json({
      success: true,
      data: availableSlots,
      count: availableSlots.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch available slots",
      error: error.message,
    });
  }
});

// Statistics endpoint (public aggregated stats)
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [
      totalHospitals,
      totalPharmacies,
      totalDoctors,
      totalPatients,
      activeAppointments,
      pendingOrders,
    ] = await Promise.all([
      Hospital.countDocuments({ isActive: true }),
      Pharmacy.countDocuments({ isActive: true }),
      User.countDocuments({ role: "DOCTOR", isActive: true }),
      User.countDocuments({ role: "PATIENT", isActive: true }),
      Appointment.countDocuments({ status: "CONFIRMED" }),
      Order.countDocuments({ status: "PENDING" }),
    ]);
    
    res.json({
      success: true,
      data: {
        hospitals: totalHospitals,
        pharmacies: totalPharmacies,
        doctors: totalDoctors,
        patients: totalPatients,
        activeAppointments,
        pendingOrders,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
});
