"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";

// Common specializations
const SPECIALIZATIONS = [
  "Cardiologist",
  "Dermatologist",
  "Neurologist",
  "Orthopedic",
  "Pediatrician",
  "Gynecologist",
  "Psychiatrist",
  "General Physician",
  "Dentist",
  "Ophthalmologist",
  "ENT Specialist",
  "Gastroenterologist",
  "Urologist",
  "Oncologist",
  "Endocrinologist",
];

interface Doctor {
  _id: string;
  id: string;
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

export default function BookAppointmentPage() {
  const router = useRouter();
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
  }, [router]);

  const fetchDoctorsBySpecialization = async (specialization: string) => {
    setLoading(true);
    try {
      const data = await apiGet<{ success: boolean; data: Doctor[] }>(
        `/api/public/doctors?search=${encodeURIComponent(specialization)}&limit=50`
      );
      const doctorsList = data.success && Array.isArray(data.data) ? data.data : [];
      
      // Fetch hospital info for each doctor
      const doctorsWithHospitals = await Promise.all(
        doctorsList.map(async (doctor) => {
          if (doctor.hospitalId) {
            try {
              const hospital = await apiGet(`/api/public/hospitals`).then((hospitals: any) => {
                const hospitalList = hospitals.success && Array.isArray(hospitals.data) 
                  ? hospitals.data 
                  : Array.isArray(hospitals) ? hospitals : [];
                return hospitalList.find((h: any) => h._id === doctor.hospitalId);
              }).catch(() => null);
              
              return { ...doctor, hospital };
            } catch {
              return doctor;
            }
          }
          return doctor;
        })
      );
      
      setDoctors(doctorsWithHospitals);
    } catch (error: any) {
      console.error("Error fetching doctors:", error);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecializationSelect = (specialization: string) => {
    setSelectedSpecialization(specialization);
    fetchDoctorsBySpecialization(specialization);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Book Appointment</h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">Find the right doctor for your needs</p>
            </div>
            <Link
              href="/appointments"
              className="rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm whitespace-nowrap flex-shrink-0"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {!selectedSpecialization ? (
          /* Step 1: Select Specialization */
          <div className="rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm p-4 sm:p-6 lg:p-8 shadow-lg">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 text-center">
              Select Specialization
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {SPECIALIZATIONS.map((spec) => (
                <button
                  key={spec}
                  onClick={() => handleSpecializationSelect(spec)}
                  className="rounded-xl border-2 border-gray-200 bg-white p-3 sm:p-4 lg:p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <div className="text-2xl sm:text-3xl mb-1 sm:mb-2">👨‍⚕️</div>
                  <h3 className="text-xs sm:text-sm lg:text-base font-semibold text-gray-900 break-words">{spec}</h3>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Step 2: Doctor List */
          <div>
            <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-4 flex-wrap">
              <button
                onClick={() => {
                  setSelectedSpecialization("");
                  setDoctors([]);
                }}
                className="rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm whitespace-nowrap"
              >
                ← Back
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">
                  {selectedSpecialization} Doctors
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {doctors.length} {doctors.length === 1 ? "doctor" : "doctors"} available
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="mt-4 text-gray-600">Loading doctors...</p>
                </div>
              </div>
            ) : doctors.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                <div className="text-6xl mb-4">👨‍⚕️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Doctors Found</h3>
                <p className="text-gray-600 mb-6">
                  No {selectedSpecialization} doctors available at the moment.
                </p>
                <button
                  onClick={() => {
                    setSelectedSpecialization("");
                    setDoctors([]);
                  }}
                  className="rounded-lg bg-blue-900 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  Choose Different Specialization
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {doctors.map((doctor) => (
                  <div
                    key={doctor._id}
                    className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/appointments/book/${doctor._id}`)}
                  >
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">Dr. {doctor.name}</h3>
                        {doctor.specialization && (
                          <p className="text-xs sm:text-sm text-blue-600 font-medium mt-1 truncate">
                            {doctor.specialization}
                          </p>
                        )}
                        {doctor.qualification && (
                          <p className="text-[10px] sm:text-xs text-gray-500 mt-1 truncate">{doctor.qualification}</p>
                        )}
                      </div>
                      <div className="text-2xl sm:text-3xl flex-shrink-0">👨‍⚕️</div>
                    </div>

                    {doctor.hospital && (
                      <div className="mb-3 sm:mb-4">
                        <p className="text-xs sm:text-sm font-semibold text-gray-700 truncate">
                          🏥 {doctor.hospital.name}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-1 line-clamp-2">{doctor.hospital.address}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-100 gap-2 sm:gap-0">
                      <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs text-gray-500">Consultation Fee</p>
                        <p className="text-base sm:text-lg font-bold text-gray-900">
                          ₹{doctor.serviceCharge || 500}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/appointments/book/${doctor._id}`);
                        }}
                        className="rounded-lg bg-blue-900 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-800 shadow-sm whitespace-nowrap flex-shrink-0"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
