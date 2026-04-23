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

export default function PatientDetailsPage() {
  const router = useRouter();

  useEffect(() => {
    console.log("Patient Details Page Loaded");
    if (typeof window !== "undefined") {
      console.log("Current URL:", window.location.href);
    }
  }, []);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [consultationType, setConsultationType] = useState<"Offline" | "Online">("Offline");
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [useNewPatient, setUseNewPatient] = useState<boolean>(false);
  const [patientForm, setPatientForm] = useState({
    name: "",
    age: "",
    address: "",
    issue: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  useEffect(() => {
    // Get selected doctor and time slot from sessionStorage
    if (typeof window !== "undefined") {
      const doctorStr = sessionStorage.getItem("selectedDoctor");
      const timeSlot = sessionStorage.getItem("selectedTimeSlot");
      const consultation = sessionStorage.getItem("consultationType");
      
      if (!doctorStr || !timeSlot) {
        toast.error("Please select a doctor first");
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/select-doctor";
          }
        }, 1000);
        return;
      }
      
      setSelectedDoctor(JSON.parse(doctorStr));
      setSelectedTimeSlot(timeSlot);
      if (consultation) {
        setConsultationType(consultation as "Offline" | "Online");
      }
      
      // Fetch patients list
      fetchPatients();
    }
  }, [router]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE}/api/users?role=PATIENT`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      
      if (res.ok) {
        const patientsData = await res.json();
        setPatients(Array.isArray(patientsData) ? patientsData : []);
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error);
      toast.error("Failed to load patients list");
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedTimeSlot) {
      toast.error("Please complete doctor selection");
      router.push("/select-doctor");
      return;
    }

    setSubmitting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      // Get patient ID - use selected patient or create new one
      let patientId = "";
      
      if (useNewPatient) {
        // For new patient, we need to create them first or use a placeholder
        // Check if patient with same name exists
        const matchingPatient = patients.find((p: any) => 
          p.name?.toLowerCase() === patientForm.name.toLowerCase()
        );
        
        if (matchingPatient) {
          patientId = matchingPatient._id || matchingPatient.id;
          toast.success("Using existing patient with same name");
        } else {
          // For now, we'll require creating patient first
          toast.error("Please create the patient in Users section first, or select an existing patient.");
          return;
        }
      } else {
        // Use selected patient
        if (!selectedPatientId) {
          toast.error("Please select a patient or choose 'New Patient' option");
          return;
        }
        patientId = selectedPatientId;
      }

      // Create appointment date with selected time slot (use today's date)
      const appointmentDate = new Date();
      const [hours, minutes] = selectedTimeSlot.split(":");
      appointmentDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // Ensure date is today or future
      const today = new Date();
      if (appointmentDate < today) {
        appointmentDate.setDate(today.getDate() + 1); // Set to tomorrow if time has passed
      }

      const appointmentData = {
        hospitalId: selectedDoctor.hospitalId || "", // Use doctor's hospital or empty
        doctorId: selectedDoctor._id,
        patientId: patientId,
        scheduledAt: appointmentDate.toISOString(),
        patientName: patientForm.name,
        age: parseInt(patientForm.age),
        address: patientForm.address,
        issue: patientForm.issue,
        channel: consultationType === "Online" ? "VIDEO" : "PHYSICAL",
      };

      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: "POST",
        headers,
        body: JSON.stringify(appointmentData),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Failed to book appointment" }));
        throw new Error(error.message || "Failed to book appointment");
      }

      // Clear session storage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("selectedDoctor");
        sessionStorage.removeItem("selectedTimeSlot");
        sessionStorage.removeItem("consultationType");
      }

      toast.success("Appointment booked successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to book appointment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/select-doctor";
    }
  };

  if (!selectedDoctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

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

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6 sm:mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">Step 2: Patient Details</h1>
          </div>
          <p className="text-gray-300 text-sm sm:text-base ml-6">
            Fill in your personal information to complete the booking
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-slate-700"
        >
          {/* Selected Doctor Summary */}
          <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <p className="text-gray-400 text-xs mb-2">Selected Doctor</p>
            <p className="text-white font-semibold text-lg">{selectedDoctor.name}</p>
            <p className="text-gray-300 text-sm">{selectedDoctor.specialization}</p>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-400 text-xs">Time: {selectedTimeSlot}</p>
              <p className="text-gray-400 text-xs">Type: {consultationType}</p>
            </div>
          </div>

          <form onSubmit={handleBookAppointment} className="space-y-6">
            {/* Patient Selection */}
            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Select Patient <span className="text-red-400">*</span>
              </label>
              <div className="mb-3">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    checked={!useNewPatient}
                    onChange={() => setUseNewPatient(false)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>Existing Patient</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer ml-6">
                  <input
                    type="radio"
                    checked={useNewPatient}
                    onChange={() => setUseNewPatient(true)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>New Patient (create in Users section first)</span>
                </label>
              </div>
              
              {!useNewPatient ? (
                <select
                  required={!useNewPatient}
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    const patient = patients.find(p => (p._id || p.id) === e.target.value);
                    if (patient) {
                      setPatientForm({
                        name: patient.name || "",
                        age: "",
                        address: "",
                        issue: "",
                      });
                    }
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  disabled={loadingPatients}
                >
                  <option value="">Select a patient...</option>
                  {patients.map((patient) => (
                    <option key={patient._id || patient.id} value={patient._id || patient.id}>
                      {patient.name} {patient.email ? `(${patient.email})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ For new patients, please create them in the Users section first, then return here to book.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Patient Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={patientForm.name}
                onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
                placeholder="Enter patient full name"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                disabled={!useNewPatient && selectedPatientId !== ""}
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Age <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                max="120"
                value={patientForm.age}
                onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })}
                placeholder="Enter your age"
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Address <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                value={patientForm.address}
                onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })}
                placeholder="Enter your address"
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">
                Issue / Problem Description <span className="text-red-400">*</span>
              </label>
              <textarea
                required
                value={patientForm.issue}
                onChange={(e) => setPatientForm({ ...patientForm, issue: e.target.value })}
                placeholder="Describe your health issue or problem"
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
              />
            </div>

            <div className="flex gap-4">
              <motion.button
                type="button"
                onClick={handleBack}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-6 py-3 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-600 transition-colors"
              >
                Back
              </motion.button>
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    Booking...
                  </span>
                ) : (
                  "Book Appointment"
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

