"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  age: number;
  issue: string;
  channel: string;
}

interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

interface FeeItem {
  type: string;
  description: string;
  amount: number;
}

export default function PrescriptionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const appointmentId = params.id as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([
    { medicineName: "", dosage: "", frequency: "", duration: "" },
  ]);
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [consultationFee, setConsultationFee] = useState(0);
  const [extraFees, setExtraFees] = useState<FeeItem[]>([]);
  const [newFee, setNewFee] = useState({ type: "", description: "", amount: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>("");
  const [showPharmacySelection, setShowPharmacySelection] = useState(false);

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
      
      if (userData.serviceCharge) {
        setConsultationFee(userData.serviceCharge);
      }
    }
  }, [router]);

  useEffect(() => {
    if (!token) return;
    
    // Load pharmacies
    const fetchPharmacies = async () => {
      try {
        const data = await apiGet<any>("/api/public/pharmacies");
        setPharmacies(Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []));
      } catch (error) {
        console.error("Error fetching pharmacies:", error);
      }
    };
    
    fetchPharmacies();
  }, [token]);

  useEffect(() => {
    if (!token || !appointmentId) return;
    
    const fetchAppointment = async () => {
      try {
        const data = await apiGet<Appointment>(`/api/appointments/${appointmentId}`);
        setAppointment(data);
        
        // Check for AI suggestions from URL
        const suggestionsParam = searchParams?.get("suggestions");
        if (suggestionsParam) {
          try {
            const suggestions = JSON.parse(decodeURIComponent(suggestionsParam));
            if (suggestions.medicines) {
              setItems(suggestions.medicines);
            }
            if (suggestions.diagnosis && suggestions.diagnosis.length > 0) {
              setDiagnosis(suggestions.diagnosis.join(", "));
            }
            if (suggestions.notes) {
              setNotes(suggestions.notes);
            }
          } catch (e) {
            console.error("Error parsing suggestions:", e);
          }
        }
      } catch (error: any) {
        console.error("Error fetching appointment:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointment();
  }, [token, appointmentId, searchParams]);

  const handleAddItem = () => {
    setItems([...items, { medicineName: "", dosage: "", frequency: "", duration: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof PrescriptionItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleAddFee = () => {
    if (newFee.type && newFee.description && newFee.amount > 0) {
      setExtraFees([...extraFees, { ...newFee }]);
      setNewFee({ type: "", description: "", amount: 0 });
    }
  };

  const handleRemoveFee = (index: number) => {
    setExtraFees(extraFees.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !appointment || !user?.id) return;

    const validItems = items.filter(
      item => item.medicineName.trim() && item.dosage.trim() && item.frequency.trim() && item.duration.trim()
    );
    
    if (validItems.length === 0) {
      alert("Please add at least one medicine");
      return;
    }

    setSubmitting(true);
    try {
      if (diagnosis.trim()) {
        try {
          await apiPost(`/api/patient-records/${appointment.patientId}/diagnosis`, {
            diagnosis: diagnosis.trim(),
          });
        } catch (error) {
          console.error("Failed to update patient diagnosis:", error);
        }
      }

      // Show pharmacy selection if not already selected
      if (!selectedPharmacyId) {
        setShowPharmacySelection(true);
        alert("Please select a pharmacy to send the prescription to");
        return;
      }

      const prescription = await apiPost<{ _id: string }>("/api/prescriptions", {
        appointmentId: appointment._id,
        doctorId: user.id,
        patientId: appointment.patientId,
        pharmacyId: selectedPharmacyId,
        items: validItems,
        notes: notes || undefined,
        suggestions: diagnosis ? `Diagnosis: ${diagnosis}. ${notes || ""}`.trim() : notes || undefined,
        followUpDate: followUpDate || undefined,
      });

      const totalExtraFees = extraFees.reduce((sum, fee) => sum + fee.amount, 0);
      const totalAmount = consultationFee + totalExtraFees;

      if (totalAmount > 0) {
        await apiPost("/api/finance", {
          doctorId: user.id,
          patientId: appointment.patientId,
          hospitalId: user.hospitalId,
          type: "CONSULTATION_REVENUE",
          amount: consultationFee,
          meta: {
            appointmentId: appointment._id,
            prescriptionId: prescription._id,
            type: "consultation",
          },
          occurredAt: new Date(),
        });

        for (const fee of extraFees) {
          let feeType: string = "EXTRA_FEE";
          if (fee.type === "TREATMENT") {
            feeType = "TREATMENT_FEE";
          } else if (fee.type === "PROCEDURE") {
            feeType = "PROCEDURE_FEE";
          }
          
          await apiPost("/api/finance", {
            doctorId: user.id,
            patientId: appointment.patientId,
            hospitalId: user.hospitalId,
            type: feeType,
            amount: fee.amount,
            meta: {
              appointmentId: appointment._id,
              prescriptionId: prescription._id,
              description: fee.description,
            },
            occurredAt: new Date(),
          });
        }
      }

      alert("Prescription created and fees recorded successfully!");
      router.push("/appointments");
    } catch (error: any) {
      alert("Failed to create prescription: " + (error.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  };

  const totalFees = consultationFee + extraFees.reduce((sum, fee) => sum + fee.amount, 0);

  if (loading) {
    return (
      <DashboardLayout title="Generate Prescription" description="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!appointment) {
    return (
      <DashboardLayout title="Generate Prescription" description="Appointment not found">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Appointment Not Found</h2>
            <Link href="/appointments" className="text-blue-900 hover:text-blue-800">
              Back to Appointments
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Generate Prescription"
      description={`Patient: ${appointment.patientName} | Age: ${appointment.age}`}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Pharmacy Selection */}
          {showPharmacySelection && (
            <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">🏥 Select Pharmacy</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pharmacies.length === 0 ? (
                  <p className="text-gray-600">Loading pharmacies...</p>
                ) : (
                  pharmacies.map((pharmacy: any) => (
                    <label
                      key={pharmacy._id}
                      className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedPharmacyId === pharmacy._id
                          ? "border-blue-600 bg-white shadow-md"
                          : "border-gray-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="pharmacy"
                        value={pharmacy._id}
                        checked={selectedPharmacyId === pharmacy._id}
                        onChange={(e) => {
                          setSelectedPharmacyId(e.target.value);
                          setShowPharmacySelection(false);
                        }}
                        className="mr-3 w-5 h-5 text-blue-600"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{pharmacy.name}</h3>
                        {pharmacy.address && (
                          <p className="text-sm text-gray-600">{pharmacy.address}</p>
                        )}
                        {pharmacy.phone && (
                          <p className="text-sm text-gray-500">📞 {pharmacy.phone}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
              {selectedPharmacyId && (
                <button
                  type="button"
                  onClick={() => setShowPharmacySelection(false)}
                  className="mt-4 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold hover:bg-blue-800"
                >
                  Continue
                </button>
              )}
            </div>
          )}

          {selectedPharmacyId && !showPharmacySelection && (
            <div className="rounded-lg border border-green-300 bg-green-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Selected Pharmacy:</p>
                  <p className="font-semibold text-gray-900">
                    {pharmacies.find((p: any) => p._id === selectedPharmacyId)?.name || "Unknown"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPharmacySelection(true)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          {/* Diagnosis */}
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">🔬 Diagnosis</h2>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              placeholder="Enter diagnosis (e.g., Common Cold, Hypertension, etc.)"
            />
          </div>

          {/* Medicines */}
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">💊 Prescribed Medicines</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                + Add Medicine
              </button>
            </div>
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Medicine Name</label>
                      <input
                        type="text"
                        value={item.medicineName}
                        onChange={(e) => handleItemChange(index, "medicineName", e.target.value)}
                        placeholder="e.g., Paracetamol"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Dosage</label>
                      <input
                        type="text"
                        value={item.dosage}
                        onChange={(e) => handleItemChange(index, "dosage", e.target.value)}
                        placeholder="e.g., 500mg"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Frequency</label>
                      <input
                        type="text"
                        value={item.frequency}
                        onChange={(e) => handleItemChange(index, "frequency", e.target.value)}
                        placeholder="e.g., Twice daily"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Duration</label>
                      <input
                        type="text"
                        value={item.duration}
                        onChange={(e) => handleItemChange(index, "duration", e.target.value)}
                        placeholder="e.g., 5 days"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={item.notes || ""}
                      onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                      placeholder="Additional notes (optional)"
                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Notes & Follow-up */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Additional Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                placeholder="Enter additional notes, advice, or instructions for the patient..."
              />
            </div>
            <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-4">📅 Follow-up</h2>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Follow-up Date (Optional)</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
              <p className="text-xs text-gray-500 mt-2">
                Set a follow-up appointment date if needed
              </p>
            </div>
          </div>

          {/* Fees */}
          <div className="rounded-lg border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Consultation Fees</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Consultation Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={consultationFee}
                onChange={(e) => setConsultationFee(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
              />
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Extra Fees</h3>
              <div className="grid gap-3 md:grid-cols-4 mb-3">
                <select
                  value={newFee.type}
                  onChange={(e) => setNewFee({ ...newFee, type: e.target.value })}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                >
                  <option value="">Select type</option>
                  <option value="TREATMENT">Treatment</option>
                  <option value="PROCEDURE">Procedure</option>
                  <option value="EXTRA">Extra</option>
                </select>
                <input
                  type="text"
                  value={newFee.description}
                  onChange={(e) => setNewFee({ ...newFee, description: e.target.value })}
                  placeholder="Description"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newFee.amount || ""}
                  onChange={(e) => setNewFee({ ...newFee, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Amount (₹)"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-900 focus:ring-2 focus:ring-blue-900/20"
                />
                <button
                  type="button"
                  onClick={handleAddFee}
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  Add Fee
                </button>
              </div>
              
              {extraFees.length > 0 && (
                <div className="space-y-2">
                  {extraFees.map((fee, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div>
                        <span className="font-semibold text-gray-900">{fee.type}</span>
                        <span className="text-gray-600 ml-2">- {fee.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">₹{fee.amount.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFee(idx)}
                          className="text-red-600 hover:text-red-800 font-semibold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">Total Fees:</span>
                <span className="text-3xl font-bold text-blue-900">₹{totalFees.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              href={`/consultation/${appointmentId}`}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 shadow-sm text-center"
            >
              ← Back to Consultation
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Creating Prescription..." : "✅ Create Prescription & Record Fees"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
