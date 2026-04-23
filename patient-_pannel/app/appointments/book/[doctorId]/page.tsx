"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "@/lib/api";
import { getSocket, onSocketEvent, offSocketEvent } from "@/lib/socket";

interface Doctor {
  _id: string;
  name: string;
  specialization?: string;
  qualification?: string;
  serviceCharge?: number;
  hospitalId?: string;
  hospital?: {
    name: string;
    address: string;
  };
}

interface Slot {
  _id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  date: string;
}

export default function DoctorBookingPage() {
  const router = useRouter();
  const params = useParams();
  const doctorId = params.doctorId as string;
  
  const [step, setStep] = useState(1); // 1: Details, 2: Slot, 3: Personal Info, 4: Payment
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [hasAvailableSlot, setHasAvailableSlot] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    patientName: "",
    age: "",
    gender: "",
    address: "",
    issue: "",
    channel: "PHYSICAL" as "PHYSICAL" | "VIDEO",
  });
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setToken(storedToken);
      setFormData(prev => ({ ...prev, patientName: userData.name || "" }));
      
      // Socket is already initialized in SocketProvider, no need to initialize again
    }
  }, [router]);
  
  // Listen for real-time slot updates
  useEffect(() => {
    if (!token || !doctorId) return;
    
    const socket = getSocket();
    if (!socket) return;
    
    const handleSlotUpdate = (data: any) => {
      // If slot update is for this doctor and selected date, refresh slots
      if (data.doctorId === doctorId && selectedDate) {
        const slotDate = new Date(data.date).toISOString().split("T")[0];
        if (slotDate === selectedDate) {
          checkSlotAvailability();
        }
      }
    };
    
    const handleSlotBooked = (data: any) => {
      // If slot was booked for this doctor, refresh slots
      if (data.doctorId === doctorId && selectedDate) {
        checkSlotAvailability();
      }
    };
    
    onSocketEvent("slot:updated", handleSlotUpdate);
    onSocketEvent("slot:booked", handleSlotBooked);
    
    return () => {
      offSocketEvent("slot:updated", handleSlotUpdate);
      offSocketEvent("slot:booked", handleSlotBooked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, doctorId, selectedDate]);

  useEffect(() => {
    if (!token || !doctorId) return;
    fetchDoctorDetails();
  }, [token, doctorId]);

  useEffect(() => {
    if (selectedDate && doctorId) {
      checkSlotAvailability();
    }
  }, [selectedDate, doctorId]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch doctor by ID using search (backend now supports ObjectId search)
      const data = await apiGet<{ success: boolean; data: Doctor[] }>(
        `/api/public/doctors?search=${encodeURIComponent(doctorId)}&limit=10`
      );
      const doctorsList = data.success && Array.isArray(data.data) ? data.data : [];
      const doctorData = doctorsList.find((d: any) => d._id === doctorId || (d as any).id === doctorId) || null;
      
      if (!doctorData) {
        setError("Doctor not found. Please try selecting a doctor again.");
        setLoading(false);
        return;
      }
      
      // Fetch hospital info
      if (doctorData.hospitalId) {
        try {
          const hospitals = await apiGet(`/api/public/hospitals`).then((h: any) => {
            const hospitalList = h.success && Array.isArray(h.data) 
              ? h.data 
              : Array.isArray(h) ? h : [];
            return hospitalList;
          });
          const hospital = hospitals.find((h: any) => h._id === doctorData?.hospitalId);
          setDoctor({ ...doctorData, hospital });
        } catch {
          setDoctor(doctorData);
        }
      } else {
        setDoctor(doctorData);
      }
    } catch (error: any) {
      console.error("Error fetching doctor:", error);
      setError("Failed to load doctor details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const checkSlotAvailability = async () => {
    try {
      const queryParams = new URLSearchParams({
        doctorId,
        date: selectedDate,
      });
      if (doctor?.hospitalId) {
        queryParams.append("hospitalId", doctor.hospitalId);
      }
      
      const data = await apiGet<Slot[]>(
        `/api/schedules/slots/available?${queryParams.toString()}`
      );
      const availableSlots = Array.isArray(data) ? data.filter(s => !s.isBooked) : [];
      setSlots(availableSlots);
      setHasAvailableSlot(availableSlots.length > 0);
    } catch (error: any) {
      console.error("Error checking slots:", error);
      setSlots([]);
      setHasAvailableSlot(false);
    }
  };

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date.toISOString().split("T")[0]);
    }
    return days;
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot("");
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
    setStep(3);
  };

  const handleAutoBook = () => {
    // Auto-book if slot available, otherwise show slot selection
    if (hasAvailableSlot && slots.length > 0) {
      handleSlotSelect(slots[0]._id);
    } else {
      setStep(2);
    }
  };

  const handlePayment = async () => {
    if (!token || !user || !doctor || !selectedDate) return;

    setProcessingPayment(true);
    
    // Simulate payment processing (dummy)
    await new Promise(resolve => setTimeout(resolve, 2000));

    setProcessingPayment(false);
    setLoading(true);

    try {
      const patientId = user.id || user._id;
      if (!patientId) {
        toast.error("User information is missing");
        return;
      }

      let scheduledAt: string;
      if (selectedSlot) {
        const slot = slots.find(s => s._id === selectedSlot);
        scheduledAt = slot ? new Date(slot.startTime).toISOString() : new Date(selectedDate).toISOString();
      } else {
        scheduledAt = new Date(selectedDate).toISOString();
      }

      const appointmentData: any = {
        hospitalId: doctor.hospitalId || "",
        doctorId: doctor._id,
        patientId: patientId,
        scheduledAt,
        patientName: formData.patientName.trim(),
        age: parseInt(formData.age),
        address: formData.address.trim(),
        issue: formData.issue.trim(),
        channel: formData.channel,
      };

      if (selectedSlot) {
        appointmentData.slotId = selectedSlot;
      }

      await apiPost("/api/appointments", appointmentData);

      toast.success("Appointment booked successfully!");
      setTimeout(() => {
        router.push("/appointments");
      }, 1000);
    } catch (error: any) {
      toast.error("Failed to book appointment: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading doctor details...</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Doctor Not Found</h2>
          <p className="text-gray-600 mb-6">{error || "The doctor you're looking for could not be found."}</p>
          <Link
            href="/appointments/book"
            className="inline-block rounded-lg bg-blue-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            Go Back to Select Doctor
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
              {/* Back Button - Mobile Optimized */}
              <button
                onClick={() => router.back()}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">Back</span>
              </button>
              
              <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
              
              {/* Progress Steps - Compact for Mobile */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="flex items-center">
                    <div className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full transition-all ${
                      step >= s ? 'bg-blue-600' : 'bg-gray-300'
                    }`}></div>
                    {s < 4 && (
                      <div className={`h-0.5 w-2 sm:w-3 mx-0.5 sm:mx-1 transition-all ${
                        step > s ? 'bg-blue-600' : 'bg-gray-300'
                      }`}></div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="ml-2 sm:ml-3">
                <h1 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Book Appointment</h1>
                <p className="text-xs text-gray-500">Step {step} of 4</p>
              </div>
            </div>
            <Link
              href="/appointments/book"
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors w-full sm:w-auto text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        {/* Step 1: Doctor Details */}
        {step === 1 && (
          <div className="space-y-4 sm:space-y-6">
            {/* Professional Doctor Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                {/* Avatar - Responsive */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg bg-blue-100 flex items-center justify-center text-3xl sm:text-4xl md:text-5xl">
                    👨‍⚕️
                  </div>
                </div>
                
                {/* Doctor Info - Responsive */}
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 mb-2">Dr. {doctor.name}</h2>
                  {doctor.specialization && (
                    <p className="text-base sm:text-lg text-blue-700 font-medium mb-1">{doctor.specialization}</p>
                  )}
                  {doctor.qualification && (
                    <p className="text-sm text-gray-600">{doctor.qualification}</p>
                  )}
                </div>
              </div>

              {/* Clinic Info - Responsive */}
              {doctor.hospital && (
                <div className="mb-4 sm:mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl sm:text-3xl flex-shrink-0">🏥</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-base sm:text-lg mb-1">{doctor.hospital.name}</p>
                      <p className="text-sm text-gray-600 break-words">{doctor.hospital.address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Consultation Fee - Responsive */}
              <div className="p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Consultation Fee</p>
                <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-700">₹{doctor.serviceCharge || 500}</p>
              </div>
            </div>

            {/* Professional Date Selection - Mobile Responsive */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Select Date
              </h3>
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {getNext7Days().map((date) => {
                  const dateObj = new Date(date);
                  const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                  const dayNum = dateObj.getDate();
                  const isSelected = selectedDate === date;
                  const isToday = date === new Date().toISOString().split("T")[0];
                  
                  return (
                    <button
                      key={date}
                      onClick={() => handleDateSelect(date)}
                      className={`flex-shrink-0 w-16 h-20 sm:w-20 sm:h-24 md:w-24 md:h-28 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white shadow-md"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center h-full p-1 sm:p-2">
                        <span className={`text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1 ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                          {dayName}
                        </span>
                        <span className={`text-xl sm:text-2xl md:text-3xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {dayNum}
                        </span>
                        {isToday && !isSelected && (
                          <span className="text-[8px] sm:text-[10px] text-blue-600 font-medium mt-0.5 sm:mt-1">Today</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div className="mt-4 sm:mt-6 space-y-3 sm:space-y-4">
                {hasAvailableSlot ? (
                  <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-lg sm:text-xl flex-shrink-0">✓</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-green-800 font-semibold text-sm sm:text-base">Slot Available</p>
                        <p className="text-xs sm:text-sm text-green-700 mt-0.5 break-words">
                          Doctor has available slots for {new Date(selectedDate).toLocaleDateString("en-US", { 
                            weekday: "long", 
                            year: "numeric", 
                            month: "long", 
                            day: "numeric" 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-lg sm:text-xl flex-shrink-0">⚠</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-amber-800 font-semibold text-sm sm:text-base">No Pre-defined Slots</p>
                        <p className="text-xs sm:text-sm text-amber-700 mt-0.5">
                          You can still book by selecting a time manually
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <button
                  onClick={handleAutoBook}
                  className="w-full rounded-lg bg-blue-600 px-4 py-3 sm:px-6 sm:py-3.5 font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <span>{hasAvailableSlot ? "Continue to Slot Selection" : "Continue to Details"}</span>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Slot Selection */}
        {step === 2 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
              <div className="h-6 w-px bg-gray-300"></div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Select Time Slot
              </h2>
            </div>

            {slots.length > 0 ? (
              <div>
                <p className="text-gray-600 mb-6 text-base">
                  Available slots for <span className="font-semibold text-gray-900">
                    {new Date(selectedDate).toLocaleDateString("en-US", { 
                      weekday: "long", 
                      year: "numeric", 
                      month: "long", 
                      day: "numeric" 
                    })}
                  </span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {slots.map((slot) => {
                    const startTime = new Date(slot.startTime).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isSelected = selectedSlot === slot._id;
                    return (
                      <button
                        key={slot._id}
                        onClick={() => handleSlotSelect(slot._id)}
                        className={`rounded-xl border-2 p-4 text-sm font-semibold transition-all transform hover:scale-105 ${
                          isSelected
                            ? "border-blue-600 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg"
                            : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                      >
                        {startTime}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-600 mb-6 text-base">No slots available. You can proceed with manual booking.</p>
                <button
                  onClick={() => setStep(3)}
                  className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-3 font-semibold text-white shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all"
                >
                  Continue to Details →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Personal Details - Professional & Responsive */}
        {step === 3 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(4);
            }}
            className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm"
          >
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setStep(selectedSlot ? 2 : 1)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Personal Details
              </h2>
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Age <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="150"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    placeholder="Enter age"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address <span className="text-red-500">*</span></label>
                <textarea
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                  placeholder="Enter your complete address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Symptoms / Problem Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={formData.issue}
                  onChange={(e) => setFormData({ ...formData, issue: e.target.value })}
                  rows={4}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm sm:text-base text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none"
                  placeholder="Describe your medical issue or reason for appointment in detail"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Appointment Type <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <label className="flex items-center cursor-pointer p-3 border-2 rounded-md transition-colors hover:bg-gray-50 flex-1 sm:flex-none">
                    <input
                      type="radio"
                      value="PHYSICAL"
                      checked={formData.channel === "PHYSICAL"}
                      onChange={(e) => setFormData({ ...formData, channel: e.target.value as "PHYSICAL" | "VIDEO" })}
                      className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm sm:text-base text-gray-700">Offline (Physical Visit)</span>
                  </label>
                  <label className="flex items-center cursor-pointer p-3 border-2 rounded-md transition-colors hover:bg-gray-50 flex-1 sm:flex-none">
                    <input
                      type="radio"
                      value="VIDEO"
                      checked={formData.channel === "VIDEO"}
                      onChange={(e) => setFormData({ ...formData, channel: e.target.value as "PHYSICAL" | "VIDEO" })}
                      className="mr-2 w-4 h-4 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-sm sm:text-base text-gray-700">Online (Video Consultation)</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm sm:text-base font-medium text-white shadow-sm hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                Continue to Payment
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Payment - Professional & Responsive */}
        {step === 4 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Payment
              </h2>
            </div>

            <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <span className="text-sm sm:text-base text-gray-700">Consultation Fee</span>
                <span className="text-xl sm:text-2xl font-bold text-gray-900">₹{doctor.serviceCharge || 500}</span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                <span>GST (if applicable)</span>
                <span>₹0</span>
              </div>
              <div className="border-t border-gray-300 pt-3 sm:pt-4 flex justify-between items-center">
                <span className="text-sm sm:text-base font-semibold text-gray-900">Total</span>
                <span className="text-xl sm:text-2xl font-bold text-gray-900">₹{doctor.serviceCharge || 500}</span>
              </div>
            </div>

            <div className="mb-4 sm:mb-6">
              <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                This is a dummy payment. No actual payment will be processed.
              </p>
              <button
                onClick={handlePayment}
                disabled={loading || processingPayment}
                className="w-full rounded-md bg-green-600 px-4 py-3 text-sm sm:text-base font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
              >
                {processingPayment ? (
                  <span className="flex items-center justify-center">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent mr-2"></span>
                    Processing Payment...
                  </span>
                ) : loading ? (
                  "Booking Appointment..."
                ) : (
                  `Pay ₹${doctor.serviceCharge || 500} & Book Appointment`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

