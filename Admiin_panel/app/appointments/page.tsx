"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

interface Appointment {
  _id: string;
  hospitalId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
  status: string;
  patientName: string;
  age: number;
  address: string;
  issue: string;
  channel: string;
  prescription?: any;
  doctor?: { name: string; specialization?: string };
  hospital?: { name: string; address?: string };
}

function mapToAppointment(
  apt: any,
  doctor?: { name: string; specialization?: string },
  hospital?: { name: string; address?: string }
): Appointment {
  return {
    _id: String(apt._id ?? ""),
    hospitalId: String(apt.hospitalId ?? ""),
    doctorId: String(apt.doctorId ?? ""),
    patientId: String(apt.patientId ?? ""),
    scheduledAt: String(apt.scheduledAt ?? ""),
    status: String(apt.status ?? ""),
    patientName: String(apt.patientName ?? ""),
    age: Number(apt.age ?? 0),
    address: String(apt.address ?? ""),
    issue: String(apt.issue ?? ""),
    channel: String(apt.channel ?? ""),
    prescription: apt.prescription ?? undefined,
    doctor: doctor,
    hospital: hospital,
  };
}

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        router.replace("/");
        return;
      }
      setToken(storedToken);
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;

    const fetchAppointments = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/appointments`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch appointments");
        }

        const appointmentsData = await res.json();
        const appointmentsList = Array.isArray(appointmentsData) ? appointmentsData : [];

        // Enrich appointments with doctor and hospital data
        const enrichedAppointments = await Promise.all(
          appointmentsList.map(async (apt: any): Promise<Appointment> => {
            let doctor: { name: string; specialization?: string } | undefined;
            let hospital: { name: string; address?: string } | undefined;

            // Fetch doctor data if doctorId exists
            if (apt.doctorId) {
              try {
                const doctorRes = await fetch(`${API_BASE}/api/users/${apt.doctorId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (doctorRes.ok) {
                  const doctorData = await doctorRes.json();
                  if (doctorData?.name) {
                    doctor = {
                      name: String(doctorData.name),
                      specialization: doctorData.specialization ? String(doctorData.specialization) : undefined,
                    };
                  }
                }
              } catch {
                // Keep doctor as undefined on error
              }
            }

            // Fetch hospital data if hospitalId exists
            if (apt.hospitalId) {
              try {
                const hospitalRes = await fetch(`${API_BASE}/api/master/hospitals/${apt.hospitalId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (hospitalRes.ok) {
                  const hospitalData = await hospitalRes.json();
                  if (hospitalData?.name) {
                    hospital = {
                      name: String(hospitalData.name),
                      address: hospitalData.address ? String(hospitalData.address) : undefined,
                    };
                  }
                }
              } catch {
                // Keep hospital as undefined on error
              }
            }

            return mapToAppointment(apt, doctor, hospital);
          })
        );

        setAppointments(enrichedAppointments);
      } catch (error: any) {
        console.error("Error fetching appointments:", error);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [token, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Appointments</h1>
      {appointments.length === 0 ? (
        <p>No appointments found.</p>
      ) : (
        <div className="space-y-4">
          {appointments.map((apt) => (
            <div key={apt._id} className="border rounded-lg p-4">
              <h2 className="font-semibold">{apt.patientName}</h2>
              <p>Issue: {apt.issue}</p>
              <p>Status: {apt.status}</p>
              {apt.doctor && <p>Doctor: {apt.doctor.name}</p>}
              {apt.hospital && <p>Hospital: {apt.hospital.name}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


