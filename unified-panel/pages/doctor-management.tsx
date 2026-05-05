import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import { DoctorIcon, PlusIcon, EditIcon, DeleteIcon, ReportsIcon, TemplatesIcon, EyeIcon } from "../components/Icons";
import { useUserStatus } from "../hooks/useUserStatus";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function DoctorManagementPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Active Tab State
  const [activeTab, setActiveTab] = useState<"management" | "records" | "prescriptions" | "documents">("management");
  
  // Doctor Management State
  const [doctors, setDoctors] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [doctorRevenue, setDoctorRevenue] = useState<Map<string, any>>(new Map());
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRevenue, setSelectedRevenue] = useState<any>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [viewingDoctor, setViewingDoctor] = useState<any>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  
  // Form states
  const [doctorForm, setDoctorForm] = useState({ 
    name: "", 
    email: "", 
    password: "",
    phone: "",
    specialization: "",
    qualification: "",
    hospitalId: "",
    serviceCharge: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Get user IDs for status tracking
  const doctorIds = doctors.map((d) => d._id || d.id).filter(Boolean);
  const { getStatus, refreshStatus } = useUserStatus(doctorIds);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
    
    // Socket is already initialized in _app.tsx, no need to initialize again
  }, [router]);

  useEffect(() => {
    if (!token) return;
    fetchAllData();
  }, [token]);
  
  // Refresh status periodically to catch any missed socket events
  useEffect(() => {
    if (!token || doctorIds.length === 0) return;
    
    const statusRefreshInterval = setInterval(() => {
      refreshStatus();
    }, 5000);
    
    return () => {
      clearInterval(statusRefreshInterval);
    };
  }, [token, doctorIds, refreshStatus]);

  const fetchDoctors = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const doctorsRes = await fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers });
      if (doctorsRes.ok) {
        const doctorsData = await doctorsRes.json();
        setDoctors(doctorsData);
      }
    } catch (e) {
      console.error("Failed to fetch doctors:", e);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [doctorsRes, hospitalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users?role=DOCTOR`, { headers }),
        fetch(`${API_BASE}/api/master/hospitals`, { headers }),
      ]);
      
      const doctorsData = doctorsRes.ok ? await doctorsRes.json() : [];
      setDoctors(doctorsData);
      setHospitals(hospitalsRes.ok ? await hospitalsRes.json() : []);
      
      // Fetch other data in background (non-blocking) - don't wait for it
      Promise.all([
        fetch(`${API_BASE}/api/users?role=PATIENT`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/api/appointments`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/api/prescriptions`, { headers }).then(r => r.ok ? r.json() : []),
        fetch(`${API_BASE}/api/finance/summary`, { headers }).then(r => r.ok ? r.json() : { entries: [] }),
      ]).then(([patientsData, appointmentsData, prescriptionsData, financeResponse]) => {
        setPatients(patientsData);
        setAppointments(appointmentsData);
        setPrescriptions(prescriptionsData);
        const financeData = financeResponse.entries || [];
        
        processRevenueData(doctorsData, appointmentsData, financeData, prescriptionsData);
        
        const verifiedPayments = financeData
          .filter((f: any) => f.type === "DOCTOR_COMMISSION" && f.meta?.verified === true);
        
        const uniquePayments = verifiedPayments.reduce((acc: any[], payment: any) => {
          const existing = acc.find((p: any) => 
            p._id === payment._id || 
            (p.meta?.appointmentId === payment.meta?.appointmentId && 
             p.doctorId === payment.doctorId &&
             p.meta?.appointmentId)
          );
          if (!existing) {
            acc.push(payment);
          }
          return acc;
        }, []);
        
        const sortedPayments = uniquePayments.sort((a: any, b: any) => 
          new Date(b.meta?.verifiedAt || b.occurredAt).getTime() - new Date(a.meta?.verifiedAt || a.occurredAt).getTime()
        );
        setPaymentHistory(sortedPayments);
      }).catch(err => {
        console.error("Background data fetch error:", err);
      });
    } catch (e) {
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const processRevenueData = (doctorsList: any[], appointmentsList: any[], financeList: any[], prescriptionsList: any[]) => {
    // Get completed appointments with payments
    const completedAppointments = appointmentsList.filter((apt: any) => 
      apt.status === "COMPLETED" || apt.status === "CONFIRMED"
    );

    // Calculate revenue per doctor - use Set to track processed doctors
    const revenueMap = new Map<string, any>();
    const processedDoctors = new Set<string>();
    
    doctorsList.forEach((doctor: any) => {
      const doctorKey = String(doctor._id || doctor.id);
      
      // Skip if already processed
      if (processedDoctors.has(doctorKey)) {
        return;
      }
      processedDoctors.add(doctorKey);
      
      const doctorAppointments = completedAppointments.filter((apt: any) => {
        const aptDoctorId = String(apt.doctorId);
        return aptDoctorId === String(doctor._id) || aptDoctorId === String(doctor.id) || 
               aptDoctorId === doctorKey;
      });
      
      const totalRevenue = doctorAppointments.reduce((sum: number, apt: any) => {
        return sum + (doctor.serviceCharge || 0);
      }, 0);

      // Get finance entries for this doctor
      const doctorFinance = financeList.filter((f: any) => {
        const fDoctorId = String(f.doctorId);
        return fDoctorId === String(doctor._id) || fDoctorId === String(doctor.id) || 
               fDoctorId === doctorKey;
      });

      const verifiedAmount = doctorFinance
        .filter((f: any) => f.type === "DOCTOR_COMMISSION" && f.meta?.verified === true)
        .reduce((sum: number, f: any) => sum + f.amount, 0);

      // Calculate pending amount based on unverified appointments only
      // Each appointment = doctor's service charge
      const unverifiedAppointments = doctorAppointments.filter((apt: any) => {
        const financeEntry = financeList.find((f: any) => 
          (f.appointmentId === apt._id || f.appointmentId === apt._id?.toString()) &&
          (f.doctorId === doctor._id || f.doctorId === doctor.id || String(f.doctorId) === doctorKey)
        );
        return !financeEntry?.meta?.verified;
      });
      
      const pendingAmount = unverifiedAppointments.reduce((sum: number, apt: any) => {
        return sum + (doctor.serviceCharge || 0);
      }, 0);

      if (doctorAppointments.length > 0 || totalRevenue > 0) {
        revenueMap.set(doctorKey, {
          doctorId: doctor._id || doctor.id,
          doctorName: doctor.name,
          totalAppointments: doctorAppointments.length,
          totalRevenue,
          verifiedAmount,
          pendingAmount,
          appointments: doctorAppointments,
        });
      }
    });

    setDoctorRevenue(revenueMap);
    
    // Create revenue review list - use Set to prevent duplicates
    const revenueList: any[] = [];
    const processedAppointments = new Set<string>();
    
    completedAppointments.forEach((apt: any) => {
      const appointmentId = apt._id || apt.id;
      
      // Skip if already processed
      if (processedAppointments.has(appointmentId)) {
        return;
      }
      processedAppointments.add(appointmentId);
      
      const doctor = doctorsList.find((d: any) => 
        (d._id === apt.doctorId || d.id === apt.doctorId) ||
        (String(d._id) === String(apt.doctorId)) || 
        (String(d.id) === String(apt.doctorId))
      );
      
      if (doctor && doctor.serviceCharge) {
        // Find finance entry - check both appointmentId field and meta.appointmentId
        const financeEntry = financeList.find((f: any) => {
          const fAppointmentId = f.appointmentId || f.meta?.appointmentId;
          const fDoctorId = String(f.doctorId);
          const doctorIdStr = String(doctor._id || doctor.id);
          const aptIdStr = String(appointmentId);
          
          return (
            f.type === "DOCTOR_COMMISSION" &&
            (fAppointmentId === appointmentId || 
             fAppointmentId === aptIdStr || 
             String(fAppointmentId) === aptIdStr) &&
            (fDoctorId === doctorIdStr || 
             f.doctorId === doctor._id || 
             f.doctorId === doctor.id)
          );
        });
        
        // Check if prescription exists for this appointment
        const hasPrescription = prescriptionsList.some((pres: any) => 
          pres.appointmentId === appointmentId || pres.appointmentId === appointmentId?.toString()
        );
        
        // Determine verified status - must be explicitly verified
        const isVerified = financeEntry?.meta?.verified === true;
        
        revenueList.push({
          appointmentId: appointmentId,
          doctorId: doctor._id || doctor.id,
          doctorName: doctor.name,
          patientName: apt.patientName,
          patientId: apt.patientId,
          scheduledAt: apt.scheduledAt,
          status: apt.status,
          amount: doctor.serviceCharge,
          verified: isVerified,
          verifiedAt: financeEntry?.meta?.verifiedAt,
          financeId: financeEntry?._id,
          hasPrescription,
        });
      }
    });

    setRevenueData(revenueList.sort((a, b) => 
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    ));
  };

  const createDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setOperationLoading("create");
    try {
      const res = await fetch(`${API_BASE}/api/users/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: doctorForm.name,
          email: doctorForm.email,
          password: doctorForm.password,
          phone: doctorForm.phone,
          role: "DOCTOR",
          specialization: doctorForm.specialization,
          qualification: doctorForm.qualification,
          hospitalId: doctorForm.hospitalId || undefined,
          serviceCharge: doctorForm.serviceCharge ? parseFloat(doctorForm.serviceCharge) : undefined,
        }),
      });
      
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create doctor");
      }

      const createdDoctor = await res.json();
      setDoctors((prev) => [createdDoctor, ...prev]);
      setDoctorForm({ 
        name: "", 
        email: "", 
        password: "",
        phone: "",
        specialization: "",
        qualification: "",
        hospitalId: "",
        serviceCharge: ""
      });
      setShowAddModal(false);
      toast.success("Doctor created successfully!");
    } catch (e: any) {
      toast.error(e.message || "Error creating doctor");
    } finally {
      setOperationLoading(null);
    }
  };

  const updateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingDoctor) return;
    setOperationLoading(`update-${editingDoctor._id}`);
    try {
      const updateData: any = {
        name: doctorForm.name,
        email: doctorForm.email,
        phone: doctorForm.phone,
        specialization: doctorForm.specialization,
        qualification: doctorForm.qualification,
        hospitalId: doctorForm.hospitalId || undefined,
        serviceCharge: doctorForm.serviceCharge ? parseFloat(doctorForm.serviceCharge) : undefined,
      };

      if (doctorForm.password) {
        updateData.password = doctorForm.password;
      }

      const res = await fetch(`${API_BASE}/api/users/${editingDoctor._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setDoctors((prev) => prev.map((d) => (d._id === editingDoctor._id ? updated : d)));
        setDoctorForm({ 
          name: "", 
          email: "", 
          password: "",
          phone: "",
          specialization: "",
          qualification: "",
          hospitalId: "",
          serviceCharge: ""
        });
        setShowEditModal(false);
        setEditingDoctor(null);
        toast.success("Doctor updated successfully!");
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || "Failed to update doctor");
      }
    } catch (e) {
      toast.error("Error updating doctor");
    } finally {
      setOperationLoading(null);
    }
  };

  const toggleDoctorStatus = async (doctor: any) => {
    if (!token) return;
    const newStatus = doctor.isActive !== false ? false : true;
    const action = newStatus ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${action} this doctor?`)) return;
    
    setOperationLoading(`toggle-${doctor._id}`);
    try {
      const res = await fetch(`${API_BASE}/api/users/${doctor._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: newStatus }),
      });
      
      if (res.ok) {
        const updated = await res.json();
        setDoctors((prev) => prev.map((d) => (d._id === doctor._id ? updated : d)));
        toast.success(`Doctor ${action}d successfully!`);
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || `Failed to ${action} doctor`);
      }
    } catch (e) {
      toast.error(`Error ${action}ing doctor`);
    } finally {
      setOperationLoading(null);
    }
  };

  const deleteDoctor = async (id: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this doctor?")) return;
    setOperationLoading(`delete-${id}`);
    try {
      const res = await fetch(`${API_BASE}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDoctors((prev) => prev.filter((d) => d._id !== id));
        toast.success("Doctor deleted successfully!");
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || "Failed to delete doctor");
      }
    } catch (e) {
      toast.error("Error deleting doctor");
    } finally {
      setOperationLoading(null);
    }
  };

  const openEditModal = (doctor: any) => {
    setEditingDoctor(doctor);
    setDoctorForm({ 
      name: doctor.name || "", 
      email: doctor.email || "", 
      password: "",
      phone: doctor.phone || "",
      specialization: doctor.specialization || "",
      qualification: doctor.qualification || "",
      hospitalId: doctor.hospitalId || "",
      serviceCharge: doctor.serviceCharge ? String(doctor.serviceCharge) : ""
    });
    setShowEditModal(true);
  };

  const getDoctorStats = (doctorId: string) => {
    const doctorAppointments = appointments.filter((apt) => apt.doctorId === doctorId);
    const doctorPrescriptions = prescriptions.filter((pres) => pres.doctorId === doctorId);
    
    return {
      totalAppointments: doctorAppointments.length,
      completedAppointments: doctorAppointments.filter((apt) => apt.status === "COMPLETED").length,
      totalPrescriptions: doctorPrescriptions.length,
    };
  };

  const getDoctorNameForPrescription = (doctorId: any) => {
    if (!doctorId) return "N/A";
    if (typeof doctorId === 'object' && doctorId.name) {
      return doctorId.name;
    }
    const idString = typeof doctorId === 'string' ? doctorId : String(doctorId);
    const doctor = doctors.find(d => d._id === idString || d.id === idString);
    return doctor?.name || (idString.length > 8 ? idString.slice(-8) : idString);
  };

  const getPatientNameForPrescription = (patientId: any) => {
    if (!patientId) return "N/A";
    if (typeof patientId === 'object' && patientId.name) {
      return patientId.name;
    }
    const idString = typeof patientId === 'string' ? patientId : String(patientId);
    const patient = patients.find(p => p._id === idString || p.id === idString);
    return patient?.name || (idString.length > 8 ? idString.slice(-8) : idString);
  };

  const prepareVerification = async (revenueItem: any) => {
    if (!token) return;
    
    // Get doctor's prescriptions for this appointment
    const appointmentPrescriptions = prescriptions.filter((pres: any) => 
      pres.appointmentId === revenueItem.appointmentId || pres.appointmentId === revenueItem.appointmentId?.toString()
    );
    
    // Get all prescriptions by this doctor
    const doctorPrescriptions = prescriptions.filter((pres: any) => 
      pres.doctorId === revenueItem.doctorId || pres.doctorId === revenueItem.doctorId?.toString()
    );
    
    // Get all appointments with prescriptions
    const appointmentsWithPrescriptions = appointments.filter((apt: any) => {
      return prescriptions.some((pres: any) => 
        (pres.appointmentId === apt._id || pres.appointmentId === apt._id?.toString()) &&
        (pres.doctorId === revenueItem.doctorId || pres.doctorId === revenueItem.doctorId?.toString())
      );
    });
    
    // Calculate total pending amount for this doctor
    const doctor = doctors.find((d: any) => d._id === revenueItem.doctorId || d.id === revenueItem.doctorId);
    const totalPendingAmount = revenueData
      .filter((r: any) => r.doctorId === revenueItem.doctorId && !r.verified && r.hasPrescription)
      .reduce((sum: number, r: any) => sum + r.amount, 0);
    
    setVerificationData({
      ...revenueItem,
      appointmentPrescriptions,
      doctorPrescriptions,
      totalPatientsPrescribed: appointmentsWithPrescriptions.length,
      totalPendingAmount,
      doctor,
    });
    setShowVerifyModal(true);
  };

  const verifyPayment = async () => {
    if (!token || !verificationData) return;
    try {
      // Find the appointment to get patientId
      const appointment = appointments.find((apt: any) => 
        apt._id === verificationData.appointmentId || apt.id === verificationData.appointmentId
      );
      
      // Create finance entry for verified payment
      const res = await fetch(`${API_BASE}/api/finance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: verificationData.doctorId,
          patientId: appointment?.patientId || verificationData.patientId,
          type: "DOCTOR_COMMISSION",
          amount: verificationData.amount,
          meta: {
            verified: true,
            verifiedAt: new Date().toISOString(),
            appointmentId: verificationData.appointmentId,
            verifiedBy: user?.id || user?._id,
            verifiedByName: user?.name,
          },
          occurredAt: verificationData.scheduledAt || new Date().toISOString(),
        }),
      });

      if (res.ok) {
        const financeEntry = await res.json();
        
        // Update revenue data immediately for real-time update
        setRevenueData((prev) => 
          prev.map((item) => 
            item.appointmentId === verificationData.appointmentId
              ? { ...item, verified: true, verifiedAt: new Date().toISOString() }
              : item
          )
        );
        
        // Update doctor revenue map
        setDoctorRevenue((prev) => {
          const newMap = new Map(prev);
          const doctorRev = newMap.get(verificationData.doctorId);
          if (doctorRev) {
            newMap.set(verificationData.doctorId, {
              ...doctorRev,
              verifiedAmount: doctorRev.verifiedAmount + verificationData.amount,
              pendingAmount: Math.max(0, doctorRev.pendingAmount - verificationData.amount),
            });
          }
          return newMap;
        });
        
        // Add to payment history immediately - check for duplicates
        const newPayment = {
          ...financeEntry,
          meta: {
            ...financeEntry.meta,
            patientName: verificationData.patientName,
          },
        };
        setPaymentHistory((prev) => {
          // Check if this payment already exists (by finance ID or appointment ID + doctor ID)
          const appointmentId = newPayment.meta?.appointmentId || newPayment.appointmentId;
          const doctorId = String(newPayment.doctorId);
          const exists = prev.some((p: any) => {
            const pAppointmentId = p.meta?.appointmentId || p.appointmentId;
            const pDoctorId = String(p.doctorId);
            return (
              p._id === newPayment._id || 
              (appointmentId && pAppointmentId === appointmentId && pDoctorId === doctorId)
            );
          });
          if (!exists) {
            return [newPayment, ...prev];
          }
          return prev;
        });
        
        // Send notification to doctor
        try {
          await fetch(`${API_BASE}/api/notifications`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              userId: verificationData.doctorId,
              type: "PAYMENT_RECEIVED",
              title: "Payment Received",
              message: `You have received ₹${verificationData.amount.toLocaleString()} for appointment with ${verificationData.patientName}`,
              channel: "PUSH",
              metadata: {
                amount: verificationData.amount,
                appointmentId: verificationData.appointmentId,
                patientName: verificationData.patientName,
              },
            }),
          });
        } catch (notifError) {
          console.error("Failed to send notification:", notifError);
        }
        
        toast.success("Payment verified and sent to doctor!");
        setShowVerifyModal(false);
        setVerificationData(null);
        
        // Refresh data in background
        fetchAllData();
      } else {
        const error = await res.json().catch(() => ({}));
        toast.error(error.message || "Failed to verify payment");
      }
    } catch (e: any) {
      toast.error("Error verifying payment");
      console.error("Verify payment error:", e);
    }
  };

  const downloadPaymentHistoryExcel = () => {
    // Create CSV content
    const headers = ['Date', 'Doctor', 'Patient', 'Amount (₹)', 'Verified By', 'Status'];
    const rows = paymentHistory.map((payment) => {
      const doctor = doctors.find((d: any) => d._id === payment.doctorId || d.id === payment.doctorId);
      const date = new Date(payment.meta?.verifiedAt || payment.occurredAt);
      return [
        date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        doctor?.name || 'Unknown Doctor',
        payment.meta?.patientName || 'N/A',
        payment.amount.toLocaleString(),
        payment.meta?.verifiedByName || 'Admin',
        'Done',
      ];
    });
    
    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Payment history downloaded successfully!');
  };

  const filteredDoctors = doctors.filter((doc) =>
    doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user) return null;

  return (
    <Layout user={user} currentPage="doctor-management">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Doctor Management
              </h2>
              <p className="text-sm text-gray-600">
                Manage doctors and their information
              </p>
            </div>
            {activeTab === "management" && (
              <motion.button
                onClick={() => {
                  setDoctorForm({ 
                    name: "", 
                    email: "", 
                    password: "",
                    phone: "",
                    specialization: "",
                    qualification: "",
                    hospitalId: "",
                    serviceCharge: ""
                  });
                  setShowAddModal(true);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 text-sm sm:text-base"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add New Doctor</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <motion.button
            onClick={() => setActiveTab("records")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full p-6 border rounded-lg transition-all text-left ${
              activeTab === "records"
                ? "border-blue-900 bg-blue-50 shadow-sm"
                : "border-gray-300 bg-white hover:border-blue-900 hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                <ReportsIcon className="w-6 h-6 text-blue-900" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-black">Doctor Records</h3>
                <p className="text-xs text-gray-500">View all records</p>
              </div>
            </div>
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <motion.button
            onClick={() => setActiveTab("prescriptions")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full p-6 border rounded-lg transition-all text-left ${
              activeTab === "prescriptions"
                ? "border-blue-900 bg-blue-50 shadow-sm"
                : "border-gray-300 bg-white hover:border-blue-900 hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                <ReportsIcon className="w-6 h-6 text-blue-900" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-black">Prescription Reports</h3>
                <p className="text-xs text-gray-500">View prescriptions</p>
              </div>
            </div>
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <motion.button
            onClick={() => setActiveTab("documents")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full p-6 border-2 rounded-xl transition-all text-left ${
              activeTab === "documents"
                ? "border-yellow-500 bg-yellow-50 shadow-lg"
                : "border-gray-300 bg-white hover:border-blue-900 hover:shadow-md"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                <TemplatesIcon className="w-6 h-6 text-blue-900" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-black">Document Panel</h3>
                <p className="text-xs text-gray-500">Manage documents</p>
              </div>
            </div>
          </motion.button>
        </motion.div>
      </div>

      {/* Doctor Management Tab */}
      {activeTab === "management" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.map((d, idx) => {
                // Only check socket status (real-time login tracking)
                const userId = d._id || d.id;
                const isOnline = getStatus(userId);
                return (
                  <motion.div
                    key={d._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, duration: 0.4 }}
                    className="p-5 border border-blue-200 rounded-lg bg-white hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                          <DoctorIcon className="w-6 h-6 text-blue-700" />
                        </div>
                        {/* Online Status Indicator */}
                        <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                          isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} title={isOnline ? 'Online' : 'Offline'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base text-gray-900 mb-2">{d.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            d.isActive !== false && isOnline
                              ? 'bg-green-100 text-green-700' 
                              : d.isActive === false
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {d.isActive === false ? 'Disabled' : isOnline ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-xs text-gray-400">#{d._id.slice(-8)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-base">📧</span>
                        <p className="text-sm text-gray-600">{d.email}</p>
                      </div>
                      {d.phone && (
                        <div className="flex items-center gap-2">
                          <span className="text-pink-500 text-base">📞</span>
                          <p className="text-sm text-gray-600">{d.phone}</p>
                        </div>
                      )}
                      {d.specialization && (
                        <div className="flex items-center gap-2">
                          <span className="text-blue-500 text-base">🏥</span>
                          <p className="text-sm text-gray-600">{d.specialization}</p>
                        </div>
                      )}
                      {d.qualification && (
                        <div className="flex items-center gap-2">
                          <span className="text-purple-500 text-base">🎓</span>
                          <p className="text-sm text-gray-600">{d.qualification}</p>
                        </div>
                      )}
                      {d.serviceCharge && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-500 text-base">💰</span>
                          <p className="text-sm text-gray-600 font-semibold">₹{d.serviceCharge.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-gray-100">
                      <motion.button
                        onClick={() => {
                          setViewingDoctor(d);
                          setShowViewModal(true);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 px-3 py-2 rounded bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                      >
                        <EyeIcon className="w-4 h-4" />
                        <span>View</span>
                      </motion.button>
                      <motion.button
                        onClick={() => openEditModal(d)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={operationLoading !== null}
                        className="flex-1 px-3 py-2 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <EditIcon className="w-4 h-4" />
                    <span>Edit</span>
                  </motion.button>
                      <motion.button
                        onClick={() => toggleDoctorStatus(d)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={operationLoading !== null}
                        className={`px-3 py-2 rounded text-sm font-medium transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${
                          d.isActive !== false
                            ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200"
                            : "bg-green-50 hover:bg-green-100 text-green-700 border border-green-200"
                        }`}
                        title={d.isActive !== false ? "Disable Doctor" : "Enable Doctor"}
                      >
                        {operationLoading === `toggle-${d._id}` ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          d.isActive !== false ? "⏸️" : "▶️"
                        )}
                      </motion.button>
                      <motion.button
                        onClick={() => deleteDoctor(d._id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={operationLoading !== null}
                        className="px-3 py-2 rounded bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {operationLoading === `delete-${d._id}` ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <DeleteIcon className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
              
              {doctors.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200">
                      <DoctorIcon className="w-10 h-10 text-blue-900" />
                    </div>
                  </div>
                  <p className="text-lg text-gray-600 font-medium mb-2">No doctors found</p>
                  <p className="text-sm text-gray-500">Click "Add New Doctor" to get started</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Doctor Records Tab */}
      {activeTab === "records" && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-6"
          >
            <input
              type="text"
              placeholder="Search doctors by name or email..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredDoctors.map((doctor, idx) => {
              const stats = getDoctorStats(doctor._id || doctor.id);
              return (
                <motion.div
                  key={doctor._id || doctor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-6 border border-gray-300 rounded-lg bg-white hover:border-blue-900 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                        {doctor.name?.charAt(0).toUpperCase() || "D"}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-black">{doctor.name}</h3>
                        <p className="text-sm text-gray-600">{doctor.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Appointments</p>
                      <p className="text-lg font-bold text-black">{stats.totalAppointments}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Prescriptions</p>
                      <p className="text-lg font-bold text-black">{stats.totalPrescriptions}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* Prescription Reports Tab */}
      {activeTab === "prescriptions" && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <h3 className="text-lg font-bold text-black mb-4">Prescription Reports</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {prescriptions.map((pres, idx) => (
                <motion.div
                  key={pres._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  onClick={() => setSelectedPrescription(pres)}
                  className="p-6 border border-gray-300 rounded-lg bg-white hover:border-blue-900 hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-900"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💊</span>
                      <h4 className="text-lg font-bold text-black">
                        Prescription #{pres._id.slice(-8)}
                      </h4>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <DoctorIcon className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-semibold text-black truncate">
                        {getDoctorNameForPrescription(pres.doctorId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">👤</span>
                      <span className="text-sm font-semibold text-black truncate">
                        {getPatientNameForPrescription(pres.patientId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-black">📅</span>
                      <span className="text-xs text-black">
                        {new Date(pres.createdAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-blue-200">
                    <p className="text-xs text-black font-medium">
                      {pres.items?.length || 0} {pres.items?.length === 1 ? 'Medicine' : 'Medicines'}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">Click to view details →</p>
                  </div>
                </motion.div>
              ))}
              {prescriptions.length === 0 && (
                <div className="col-span-full text-center py-12">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm text-black font-medium">No prescription reports found</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Prescription Detail Modal */}
          {selectedPrescription && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedPrescription(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between p-6 border-b border-gray-300 bg-gray-50">
                  <div>
                    <h3 className="text-xl font-bold text-black mb-1">
                      Prescription #{selectedPrescription._id.slice(-8)}
                    </h3>
                    <p className="text-sm text-black">
                      {getDoctorNameForPrescription(selectedPrescription.doctorId)} → {getPatientNameForPrescription(selectedPrescription.patientId)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPrescription(null)}
                    className="text-black hover:text-blue-600 text-2xl font-bold"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                    <h4 className="text-sm font-bold text-black mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                          <DoctorIcon className="w-3 h-3" />
                          Doctor:
                        </span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getDoctorNameForPrescription(selectedPrescription.doctorId)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-black">👤 Patient:</span>
                        <p className="text-sm font-semibold text-black mt-1">
                          {getPatientNameForPrescription(selectedPrescription.patientId)}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-medium text-black">📅 Date & Time:</span>
                        <p className="text-sm text-black mt-1">
                          {new Date(selectedPrescription.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedPrescription.items && selectedPrescription.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-black mb-3">
                        Medicines ({selectedPrescription.items.length} {selectedPrescription.items.length === 1 ? 'item' : 'items'})
                      </h4>
                      <div className="space-y-3">
                        {selectedPrescription.items.map((item: any, itemIdx: number) => (
                          <div key={itemIdx} className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <p className="font-bold text-base text-black mb-2">{item.medicineName}</p>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="font-semibold text-black">Dosage:</span>
                                <p className="text-black mt-1">{item.dosage || "N/A"}</p>
                              </div>
                              <div>
                                <span className="font-semibold text-black">Frequency:</span>
                                <p className="text-black mt-1">{item.frequency || "N/A"}</p>
                              </div>
                              <div className="col-span-2">
                                <span className="font-semibold text-black">Duration:</span>
                                <p className="text-black mt-1">{item.duration || "N/A"}</p>
                              </div>
                              {item.notes && (
                                <div className="col-span-2 bg-white rounded p-2 border border-green-200">
                                  <span className="font-semibold text-black text-xs">Notes:</span>
                                  <p className="text-sm text-black mt-1">{item.notes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPrescription.notes && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-300">
                      <h4 className="text-sm font-bold text-black mb-2">Additional Notes</h4>
                      <p className="text-sm text-black bg-white rounded p-3 border border-blue-200">
                        {selectedPrescription.notes}
                      </p>
                    </div>
                  )}

                  {selectedPrescription.suggestions && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-bold text-black mb-2">Suggestions</h4>
                      <p className="text-sm text-black bg-white rounded p-3 border border-green-200">
                        {selectedPrescription.suggestions}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-gray-300 bg-gray-50">
                  <motion.button
                    onClick={() => setSelectedPrescription(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full px-6 py-3 bg-white border-2 border-black text-black rounded-lg font-semibold transition-colors hover:bg-black hover:text-white"
                  >
                    Close
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* Document Panel Tab - Revenue Review */}
      {activeTab === "documents" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Revenue Review Panel</h3>
                <p className="text-sm text-gray-600">Review and verify doctor payments from appointments</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Pending</p>
                  <p className="text-lg font-bold text-orange-600">
                    ₹{revenueData.filter((r: any) => !r.verified).reduce((sum: number, r: any) => sum + r.amount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Verified</p>
                  <p className="text-lg font-bold text-green-600">
                    ₹{revenueData.filter((r: any) => r.verified).reduce((sum: number, r: any) => sum + r.amount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Transactions Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-gray-900">Appointment Payments</h4>
                <p className="text-xs text-gray-600 mt-1">Review and verify individual appointment payments</p>
              </div>
              <motion.button
                onClick={() => setShowHistoryModal(true)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium transition-all flex items-center gap-2"
              >
                <span>📥</span>
                View Full History
              </motion.button>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : revenueData.length === 0 ? (
          <div className="text-center py-12">
                <div className="text-4xl mb-3">💰</div>
                <p className="text-sm text-gray-600 font-medium">No revenue data available</p>
                <p className="text-xs text-gray-500 mt-1">Completed appointments will appear here</p>
          </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Doctor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {revenueData.map((item) => (
                      <tr key={item.appointmentId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(item.scheduledAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{item.doctorName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.patientName}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900">₹{item.amount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            item.verified
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-orange-100 text-orange-700 border border-orange-200'
                          }`}>
                            {item.verified ? 'Done' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {!item.verified ? (
                            <div className="flex items-center justify-center gap-2">
                              <motion.button
                                onClick={() => prepareVerification(item)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-3 py-1.5 rounded text-white text-xs font-medium transition-all ${
                                  item.hasPrescription 
                                    ? 'bg-green-600 hover:bg-green-700' 
                                    : 'bg-gray-400 cursor-not-allowed'
                                }`}
                                disabled={!item.hasPrescription}
                                title={!item.hasPrescription ? 'Prescription required before payment' : 'Verify Payment'}
                              >
                                Verify
                              </motion.button>
                              <motion.button
                                onClick={() => {
                                  setSelectedRevenue(item);
                                  setShowRevenueModal(true);
                                }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-3 py-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium transition-all"
                              >
                                View
                              </motion.button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center">
                              <span className="text-xs text-gray-500 italic">Completed</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Verify Payment Modal */}
      {showVerifyModal && verificationData && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Verify Payment</h2>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerificationData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Doctor Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <DoctorIcon className="w-8 h-8 text-blue-700" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{verificationData.doctorName}</h3>
                    <p className="text-sm text-gray-600">Payment Verification</p>
                  </div>
                </div>
              </div>

              {/* Prescription Summary */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3">Prescription History</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">Total Patients Prescribed</p>
                    <p className="text-2xl font-bold text-green-700">{verificationData.totalPatientsPrescribed || 0}</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-gray-600 mb-1">This Appointment</p>
                    <p className="text-2xl font-bold text-blue-700">
                      {verificationData.appointmentPrescriptions?.length > 0 ? '✓ Has Prescription' : '✗ No Prescription'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3">Payment Details</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Patient:</span>
                    <span className="text-sm font-semibold text-gray-900">{verificationData.patientName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Appointment Date:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {new Date(verificationData.scheduledAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-base font-bold text-gray-900">Payment Amount:</span>
                    <span className="text-2xl font-bold text-green-700">₹{verificationData.amount.toLocaleString()}</span>
                  </div>
                  {verificationData.totalPendingAmount > verificationData.amount && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">Total Pending for Doctor:</span>
                      <span className="text-sm font-semibold text-orange-700">₹{verificationData.totalPendingAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <motion.button
                  onClick={verifyPayment}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all"
                >
                  Verify & Send Payment
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowVerifyModal(false);
                    setVerificationData(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all"
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* View Doctor Modal */}
      {showViewModal && viewingDoctor && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Doctor Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingDoctor(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <div className="w-16 h-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200 relative">
                  <DoctorIcon className="w-8 h-8 text-blue-700" />
                  <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${
                    getStatus(viewingDoctor._id || viewingDoctor.id) ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-xl font-bold text-gray-900">{viewingDoctor.name}</h3>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      getStatus(viewingDoctor._id || viewingDoctor.id)
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {getStatus(viewingDoctor._id || viewingDoctor.id) ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">ID: #{viewingDoctor._id.slice(-8)}</p>
                </div>
              </div>

              {/* Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-lg">📧</span>
                    <p className="text-sm text-gray-900">{viewingDoctor.email}</p>
                  </div>
                </div>

                {viewingDoctor.phone && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                    <div className="flex items-center gap-2">
                      <span className="text-pink-500 text-lg">📞</span>
                      <p className="text-sm text-gray-900 font-medium">{viewingDoctor.phone}</p>
                    </div>
                  </div>
                )}

                {viewingDoctor.specialization && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Specialization</label>
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 text-lg">🏥</span>
                      <p className="text-sm text-gray-900">{viewingDoctor.specialization}</p>
                    </div>
                  </div>
                )}

                {viewingDoctor.qualification && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Qualification</label>
                    <div className="flex items-center gap-2">
                      <span className="text-purple-500 text-lg">🎓</span>
                      <p className="text-sm text-gray-900">{viewingDoctor.qualification}</p>
                    </div>
                  </div>
                )}

                {viewingDoctor.serviceCharge && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service Charge</label>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 text-lg">💰</span>
                      <p className="text-sm text-gray-900 font-semibold">₹{viewingDoctor.serviceCharge.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Statistics */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Statistics</h4>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(getDoctorStats(viewingDoctor._id || viewingDoctor.id)).map(
                    ([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-600 mb-1">
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                        </p>
                        <p className="text-lg font-bold text-gray-900">{value}</p>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingDoctor(null);
                    openEditModal(viewingDoctor);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>Edit Doctor</span>
                </motion.button>
                <motion.button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingDoctor(null);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedDoctor(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-black">Doctor Details</h3>
              <button
                onClick={() => setSelectedDoctor(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Name</h4>
                <p className="text-black">{selectedDoctor.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-1">Email</h4>
                <p className="text-black">{selectedDoctor.email}</p>
              </div>
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">Statistics</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(getDoctorStats(selectedDoctor._id || selectedDoctor.id)).map(
                    ([key, value]) => (
                      <div key={key} className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                        </p>
                        <p className="text-lg font-bold text-black">{value}</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Doctor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add New Doctor</h2>
            <form onSubmit={createDoctor} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Doctor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="new-password"
                  value={doctorForm.name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="Enter doctor name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  autoComplete="new-password"
                  value={doctorForm.email}
                  onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="doctor@example.com"
                />
                <p className="text-xs text-gray-500 mt-1">This will be used to login</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={doctorForm.password}
                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                    placeholder="Enter password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={doctorForm.phone}
                  onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specialization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.specialization}
                  onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="e.g., Cardiology, Pediatrics"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Qualification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.qualification}
                  onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="e.g., MBBS, MD"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hospital (Optional)
                </label>
                <select
                  value={doctorForm.hospitalId}
                  onChange={(e) => setDoctorForm({ ...doctorForm, hospitalId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Service Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={doctorForm.serviceCharge}
                  onChange={(e) => setDoctorForm({ ...doctorForm, serviceCharge: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="Enter service charge"
                />
                <p className="text-xs text-gray-500 mt-1">Consultation/service charge for this doctor</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={operationLoading === "create"}
                  className="flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {operationLoading === "create" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Doctor"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setDoctorForm({ 
                      name: "", 
                      email: "", 
                      password: "",
                      phone: "",
                      specialization: "",
                      qualification: "",
                      hospitalId: "",
                      serviceCharge: ""
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Doctor Modal */}
      {showEditModal && editingDoctor && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Doctor</h2>
            <form onSubmit={updateDoctor} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Doctor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={doctorForm.email}
                  onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={doctorForm.password}
                    onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                    className="w-full px-4 py-2 pr-10 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                    placeholder="Enter new password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showEditPassword ? "Hide password" : "Show password"}
                  >
                    {showEditPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={doctorForm.phone}
                  onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Specialization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.specialization}
                  onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Qualification <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={doctorForm.qualification}
                  onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hospital (Optional)
                </label>
                <select
                  value={doctorForm.hospitalId}
                  onChange={(e) => setDoctorForm({ ...doctorForm, hospitalId: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                >
                  <option value="">Select Hospital</option>
                  {hospitals.map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Service Charge (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={doctorForm.serviceCharge}
                  onChange={(e) => setDoctorForm({ ...doctorForm, serviceCharge: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                  placeholder="Enter service charge"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={operationLoading !== null}
                  className="flex-1 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {operationLoading === `update-${editingDoctor?._id}` ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Doctor"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDoctor(null);
                    setDoctorForm({ 
                      name: "", 
                      email: "", 
                      password: "",
                      phone: "",
                      specialization: "",
                      qualification: "",
                      hospitalId: "",
                      serviceCharge: ""
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Revenue Details Modal */}
      {showRevenueModal && selectedRevenue && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Revenue Details</h2>
              <button
                onClick={() => {
                  setShowRevenueModal(false);
                  setSelectedRevenue(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all"
              >
                ×
              </button>
            </div>

            {selectedRevenue.appointments ? (
              // Doctor Summary View
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <DoctorIcon className="w-8 h-8 text-blue-700" />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedRevenue.doctorName}</h3>
                      <p className="text-sm text-gray-600">Doctor Revenue Summary</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Total Appointments</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedRevenue.totalAppointments}</p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Verified Amount</p>
                    <p className="text-2xl font-bold text-green-700">₹{selectedRevenue.verifiedAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-1">Pending Amount</p>
                    <p className="text-2xl font-bold text-orange-700">₹{selectedRevenue.pendingAmount.toLocaleString()}</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h4 className="font-bold text-gray-900">Appointment Details</h4>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {selectedRevenue.appointments.map((apt: any, idx: number) => {
                      const doctor = doctors.find((d: any) => d._id === apt.doctorId || d.id === apt.doctorId);
                      const amount = doctor?.serviceCharge || 0;
                      return (
                        <div key={apt._id || idx} className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">{apt.patientName}</p>
                              <p className="text-sm text-gray-600">
                                {new Date(apt.scheduledAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">Status: {apt.status}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">₹{amount.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // Individual Appointment View
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Appointment Payment</h3>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Doctor</p>
                      <p className="font-semibold text-gray-900">{selectedRevenue.doctorName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Patient</p>
                      <p className="font-semibold text-gray-900">{selectedRevenue.patientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Appointment Date</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(selectedRevenue.scheduledAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold inline-block ${
                        selectedRevenue.verified
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-orange-100 text-orange-700 border border-orange-200'
                      }`}>
                        {selectedRevenue.verified ? 'Done' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Payment Amount</p>
                      <p className="text-3xl font-bold text-gray-900">₹{selectedRevenue.amount.toLocaleString()}</p>
                    </div>
                    {selectedRevenue.verified && selectedRevenue.verifiedAt && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Verified On</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {new Date(selectedRevenue.verifiedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {!selectedRevenue.verified && (
                  <div className="flex gap-3">
                    <motion.button
                      onClick={() => {
                        prepareVerification(selectedRevenue);
                        setShowRevenueModal(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-all"
                    >
                      Verify & Send Payment
                    </motion.button>
                    <motion.button
                      onClick={() => {
                        setShowRevenueModal(false);
                        setSelectedRevenue(null);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition-all"
                    >
                      Cancel
                    </motion.button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Payment History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Payment History</h2>
                <p className="text-sm text-gray-600 mt-1">Complete record of all verified payments</p>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={downloadPaymentHistoryExcel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all flex items-center gap-2"
                >
                  <span>📥</span>
                  Download Excel
                </motion.button>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all"
                >
                  ×
                </button>
              </div>
            </div>

            {paymentHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">📜</div>
                <p className="text-sm text-gray-600 font-medium">No payment history</p>
                <p className="text-xs text-gray-500 mt-1">Verified payments will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Doctor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Verified By</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paymentHistory.map((payment, index) => {
                      const doctor = doctors.find((d: any) => d._id === payment.doctorId || d.id === payment.doctorId);
                      // Use unique key combining finance ID and index to prevent duplicates
                      const uniqueKey = payment._id || `payment-${index}-${payment.meta?.appointmentId || ''}`;
                      return (
                        <tr key={uniqueKey} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {new Date(payment.meta?.verifiedAt || payment.occurredAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {doctor?.name || 'Unknown Doctor'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.meta?.patientName || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-700">₹{payment.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {payment.meta?.verifiedByName || 'Admin'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-1 rounded-full font-semibold bg-green-100 text-green-700 border border-green-200">
                              Done
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
