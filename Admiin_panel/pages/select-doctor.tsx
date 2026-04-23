import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface Doctor {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  specialization: string;
  qualification?: string;
  serviceCharge?: number;
  hospitalId?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function SelectDoctorPage() {
  const router = useRouter();
  
  // Debug: Log when component mounts
  useEffect(() => {
    console.log("Select Doctor Page Loaded");
    if (typeof window !== "undefined") {
      console.log("Current URL:", window.location.href);
    }
  }, []);
  
  // Doctor Selection
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [consultationType, setConsultationType] = useState<"Offline" | "Online">("Offline");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [showDoctorDetails, setShowDoctorDetails] = useState<Doctor | null>(null);

  // Generate time slots (9 AM to 6 PM, hourly)
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 9; hour <= 18; hour++) {
      const time = `${hour.toString().padStart(2, "0")}:00`;
      slots.push({ time, available: true });
    }
    return slots;
  };

  useEffect(() => {
    fetchSpecializations();
    setTimeSlots(generateTimeSlots());
  }, []);

  // Update filtered doctors when doctors list or specialization changes
  useEffect(() => {
    if (doctors.length > 0) {
      if (selectedSpecialization) {
        const filtered = doctors.filter(
          (d) => d.specialization?.toLowerCase() === selectedSpecialization.toLowerCase()
        );
        setFilteredDoctors(filtered);
      } else {
        // Show all doctors when no specialization is selected
        setFilteredDoctors(doctors);
      }
    }
  }, [doctors, selectedSpecialization]);

  useEffect(() => {
    if (selectedDoctor) {
      checkTimeSlotAvailability();
    }
  }, [selectedDoctor]);

  const fetchSpecializations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users?role=DOCTOR`);
      if (res.ok) {
        const doctorsData: Doctor[] = await res.json();
        // Extract unique specializations
        const uniqueSpecializations = Array.from(
          new Set(doctorsData.map((d) => d.specialization).filter(Boolean))
        ) as string[];
        setSpecializations(uniqueSpecializations.sort());
        setDoctors(doctorsData);
      }
    } catch (error) {
      toast.error("Failed to fetch specializations");
    } finally {
      setLoading(false);
    }
  };


  const checkTimeSlotAvailability = async () => {
    if (!selectedDoctor) return;
    
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      
      const res = await fetch(`${API_BASE}/api/appointments?doctorId=${selectedDoctor._id}`, { headers });
      if (res.ok) {
        const appointments = await res.json();
        const today = new Date().toISOString().split("T")[0];
        
        const updatedSlots = timeSlots.map((slot) => {
          const isBooked = appointments.some((apt: any) => {
            const aptDate = new Date(apt.appointmentDate).toISOString().split("T")[0];
            const aptTime = new Date(apt.appointmentDate).toTimeString().split(":")[0] + ":00";
            return aptDate === today && aptTime === slot.time && apt.status !== "CANCELLED";
          });
          return { ...slot, available: !isBooked };
        });
        
        setTimeSlots(updatedSlots);
      }
    } catch (error) {
      console.error("Failed to check time slot availability:", error);
    }
  };

  const handleNext = () => {
    if (!selectedDoctor) {
      toast.error("Please select a doctor");
      return;
    }
    if (!selectedTimeSlot) {
      toast.error("Please select a time slot");
      return;
    }
    
    // Store selection in sessionStorage and navigate to patient details page
    if (typeof window !== "undefined") {
      sessionStorage.setItem("selectedDoctor", JSON.stringify(selectedDoctor));
      sessionStorage.setItem("selectedTimeSlot", selectedTimeSlot);
      sessionStorage.setItem("consultationType", consultationType);
      
      // Force navigation
      window.location.href = "/patient-details";
    }
  };

  const clearSpecialization = () => {
    setSelectedSpecialization("");
    setFilteredDoctors([]);
    setSelectedDoctor(null);
    setSelectedTimeSlot("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-6 lg:p-8">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1e293b",
            color: "#fff",
            borderRadius: "8px",
            border: "1px solid #334155",
          },
        }}
      />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Step 1: Select Doctor</h1>
          </div>
          <p className="text-gray-300 text-sm sm:text-base ml-6">
            Choose your specialization, doctor, consultation type, and time slot
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700"
        >
          {/* Specialization Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-300 text-sm font-medium">Select Specialization</label>
              {selectedSpecialization && (
                <button
                  onClick={clearSpecialization}
                  className="text-xs px-3 py-1.5 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-gray-400 text-xs mb-4">
              Choose a specialization to filter doctors (optional)
            </p>
            <select
              value={selectedSpecialization}
              onChange={(e) => setSelectedSpecialization(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="">All Specializations</option>
              {specializations.map((spec) => (
                <option key={spec} value={spec} className="bg-slate-700">
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {/* Doctor Selection */}
          <div className="mb-6">
            <label className="text-gray-300 text-sm font-medium mb-2 block">
              Select Doctor <span className="text-red-400">*</span>
            </label>
            {loadingDoctors ? (
              <div className="flex items-center justify-center py-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
                />
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">👨‍⚕️</div>
                <p className="text-gray-400">
                  {selectedSpecialization 
                    ? "No doctors found for this specialization. Please try selecting a different specialization."
                    : "No doctors available at the moment."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDoctors.map((doctor) => (
                  <motion.div
                    key={doctor._id}
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setSelectedTimeSlot("");
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDoctor?._id === doctor._id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg mb-1">{doctor.name}</h3>
                        <p className="text-gray-400 text-sm">{doctor.specialization}</p>
                      </div>
                      {selectedDoctor?._id === doctor._id && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Doctor Details */}
                    <div className="space-y-2 text-sm mb-3">
                      {doctor.qualification && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <span>🎓</span>
                          <span>{doctor.qualification}</span>
                        </div>
                      )}
                      {doctor.serviceCharge && (
                        <div className="flex items-center gap-2 text-gray-300">
                          <span>💰</span>
                          <span className="font-semibold">Consultation Fee: ₹{doctor.serviceCharge.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* View Details Button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDoctorDetails(doctor);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      View Doctor Details
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Consultation Type Selection */}
          <div className="mb-6">
            <label className="text-gray-300 text-sm font-medium mb-3 block">
              Consultation Type <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-4">
              <motion.button
                type="button"
                onClick={() => setConsultationType("Offline")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                  consultationType === "Offline"
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-slate-700 border-slate-600 text-gray-300 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">🏥</span>
                  <span className="font-semibold">Offline</span>
                </div>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setConsultationType("Online")}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all ${
                  consultationType === "Online"
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-slate-700 border-slate-600 text-gray-300 hover:border-slate-500"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">💻</span>
                  <span className="font-semibold">Online</span>
                </div>
              </motion.button>
            </div>
          </div>

          {/* Time Slot Selection */}
          {selectedDoctor && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <label className="text-gray-300 text-sm font-medium mb-3 block">
                Select Time Slot <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {timeSlots.map((slot) => (
                  <motion.button
                    key={slot.time}
                    onClick={() => setSelectedTimeSlot(slot.time)}
                    disabled={!slot.available}
                    whileHover={slot.available ? { scale: 1.05 } : {}}
                    whileTap={slot.available ? { scale: 0.95 } : {}}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      selectedTimeSlot === slot.time
                        ? "bg-blue-500 text-white border-2 border-blue-400"
                        : slot.available
                        ? "bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500"
                        : "bg-slate-800 text-gray-500 border-2 border-slate-700 cursor-not-allowed opacity-50"
                    }`}
                  >
                    {slot.time}
                    {!slot.available && (
                      <span className="block text-xs mt-1 text-red-400">Not Available</span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Next Button */}
          <div className="flex justify-end">
            <motion.button
              onClick={handleNext}
              disabled={!selectedDoctor || !selectedTimeSlot}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
            >
              Next
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Doctor Details Modal */}
      {showDoctorDetails && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDoctorDetails(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800 rounded-2xl p-6 max-w-md w-full border border-slate-700"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Doctor Details</h3>
              <button
                onClick={() => setShowDoctorDetails(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Name</h4>
                <p className="text-white font-semibold text-lg">{showDoctorDetails.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Specialization</h4>
                <p className="text-white">{showDoctorDetails.specialization}</p>
              </div>
              {showDoctorDetails.qualification && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Qualification</h4>
                  <p className="text-white">{showDoctorDetails.qualification}</p>
                </div>
              )}
              {showDoctorDetails.email && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Email</h4>
                  <p className="text-white text-sm">{showDoctorDetails.email}</p>
                </div>
              )}
              {showDoctorDetails.phone && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Phone</h4>
                  <p className="text-white">{showDoctorDetails.phone}</p>
                </div>
              )}
              {showDoctorDetails.serviceCharge && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-1">Consultation Fee</h4>
                  <p className="text-white font-semibold text-lg">₹{showDoctorDetails.serviceCharge.toLocaleString()}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

