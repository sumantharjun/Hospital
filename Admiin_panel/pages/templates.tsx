import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";
import { TemplatesIcon, PlusIcon } from "../components/Icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function TemplatesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    type: "PRESCRIPTION",
    hospitalId: "",
    content: "",
    headerImageUrl: "",
    doctorLogoUrl: "",
    footerText: "",
    isDefault: false,
    // Visual builder fields
    headerTitle: "",
    showHospitalName: true,
    showHospitalAddress: true,
    showHospitalPhone: true,
    showDoctorLogo: true,
    showPatientName: true,
    showPatientId: true,
    showDoctorName: true,
    showDoctorId: true,
    showDate: true,
    showTime: true,
    showMedicinesTable: true,
    showNotes: true,
    customFields: [] as Array<{ label: string; key: string; type: "text" | "textarea" }>,
  });
  const [logoPreview, setLogoPreview] = useState<string>("");

  // Blur any focused elements when modals open (fixes aria-hidden accessibility issue)
  useEffect(() => {
    if (showAddModal || showPreviewModal) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.blur) {
        activeElement.blur();
      }
    }
  }, [showAddModal, showPreviewModal]);

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!storedUser || !t) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(storedUser));
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [tRes, hRes] = await Promise.all([
          fetch(`${API_BASE}/api/templates`, { headers }),
          fetch(`${API_BASE}/api/master/hospitals`, { headers }),
        ]);
        setTemplates(tRes.ok ? await tRes.json() : []);
        setHospitals(hRes.ok ? await hRes.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const generateTemplateContent = () => {
    // Auto-generate HTML content based on visual builder settings
    let html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #000; }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
    .hospital-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #1e40af; }
    .patient-info, .doctor-info { margin-bottom: 20px; }
    .info-row { margin: 8px 0; }
    .info-label { font-weight: bold; color: #1e40af; }
    .medicines { margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #2563eb; color: white; padding: 10px; text-align: left; border: 1px solid #1e40af; }
    td { padding: 8px; border: 1px solid #cbd5e1; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #64748b; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">`;
    
    if (newTemplate.headerImageUrl) {
      html += `\n    <img src="${newTemplate.headerImageUrl}" alt="Header" style="max-width: 200px; margin-bottom: 10px;" />`;
    }
    
    // Doctor Logo Section
    if (newTemplate.showDoctorLogo && newTemplate.doctorLogoUrl) {
      html += `\n    <div style="text-align: center; margin-bottom: 15px;">`;
      html += `\n      <img src="${newTemplate.doctorLogoUrl}" alt="Doctor Logo" style="max-width: 150px; max-height: 100px; object-fit: contain;" />`;
      html += `\n    </div>`;
    }
    
    if (newTemplate.showHospitalName) {
      html += `\n    <div class="hospital-name">{{hospitalName}}</div>`;
    }
    
    if (newTemplate.headerTitle) {
      html += `\n    <div style="font-size: 18px; color: #059669;">${newTemplate.headerTitle}</div>`;
    } else {
      html += `\n    <div style="font-size: 18px; color: #059669;">${newTemplate.type === "PRESCRIPTION" ? "Prescription" : newTemplate.type === "BILL" ? "Bill/Invoice" : newTemplate.type}</div>`;
    }
    
    if (newTemplate.showHospitalAddress) {
      html += `\n    <div style="margin-top: 10px; color: #64748b;">{{hospitalAddress}}</div>`;
    }
    
    if (newTemplate.showHospitalPhone) {
      html += `\n    <div style="color: #64748b;">Phone: {{hospitalPhone}}</div>`;
    }
    
    html += `\n  </div>`;
    
    html += `\n  <div class="patient-info">`;
    if (newTemplate.showPatientName) {
      html += `\n    <div class="info-row"><span class="info-label">Patient:</span> {{patientName}}</div>`;
    }
    if (newTemplate.showPatientId) {
      html += `\n    <div class="info-row"><span class="info-label">Patient ID:</span> {{patientId}}</div>`;
    }
    html += `\n  </div>`;
    
    html += `\n  <div class="doctor-info">`;
    if (newTemplate.showDoctorName) {
      html += `\n    <div class="info-row"><span class="info-label">Doctor:</span> {{doctorName}}</div>`;
    }
    if (newTemplate.showDoctorId) {
      html += `\n    <div class="info-row"><span class="info-label">Doctor ID:</span> {{doctorId}}</div>`;
    }
    if (newTemplate.showDate) {
      html += `\n    <div class="info-row"><span class="info-label">Date:</span> {{date}}</div>`;
    }
    if (newTemplate.showTime) {
      html += `\n    <div class="info-row"><span class="info-label">Time:</span> {{time}}</div>`;
    }
    html += `\n  </div>`;
    
    if (newTemplate.showMedicinesTable && (newTemplate.type === "PRESCRIPTION" || newTemplate.type === "BILL")) {
      html += `\n  <div class="medicines">`;
      html += `\n    <h3 style="color: #059669; margin-bottom: 10px;">${newTemplate.type === "PRESCRIPTION" ? "Medicines:" : "Items:"}</h3>`;
      html += `\n    {{medicines}}`;
      html += `\n  </div>`;
    }
    
    if (newTemplate.showNotes) {
      html += `\n  <div style="margin-top: 20px;">`;
      html += `\n    <div class="info-label">Notes:</div>`;
      html += `\n    <div style="margin-top: 5px;">{{notes}}</div>`;
      html += `\n  </div>`;
    }
    
    // Add custom fields
    newTemplate.customFields.forEach((field) => {
      html += `\n  <div style="margin-top: 15px;">`;
      html += `\n    <div class="info-label">${field.label}:</div>`;
      html += `\n    <div style="margin-top: 5px;">{{${field.key}}}</div>`;
      html += `\n  </div>`;
    });
    
    if (newTemplate.footerText) {
      html += `\n  <div class="footer">${newTemplate.footerText}</div>`;
    } else {
      html += `\n  <div class="footer">This is a computer-generated document. Please follow medical instructions carefully.</div>`;
    }
    
    html += `\n</body>
</html>`;
    
    return html;
  };

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      // Auto-generate content from visual builder
      const generatedContent = generateTemplateContent();
      
      const payload = {
        ...newTemplate,
        hospitalId: newTemplate.hospitalId || null,
        content: generatedContent,
      };

      const url = editingTemplate
        ? `${API_BASE}/api/templates/${editingTemplate._id}`
        : `${API_BASE}/api/templates`;
      const res = await fetch(url, {
        method: editingTemplate ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        if (editingTemplate) {
          setTemplates((prev) => prev.map((t) => (t._id === editingTemplate._id ? created : t)));
        } else {
          setTemplates((prev) => [created, ...prev]);
        }
        resetForm();
        toast.success(`Template ${editingTemplate ? "updated" : "created"} successfully!`);
      } else {
        const data = await res.json();
        toast.error(data.message || "Failed to save template");
      }
    } catch (e) {
      toast.error("Error saving template");
    }
  };

  const resetForm = () => {
    setNewTemplate({
      name: "",
      type: "PRESCRIPTION",
      hospitalId: "",
      content: "",
      headerImageUrl: "",
      doctorLogoUrl: "",
      footerText: "",
      isDefault: false,
      headerTitle: "",
      showHospitalName: true,
      showHospitalAddress: true,
      showHospitalPhone: true,
      showDoctorLogo: true,
      showPatientName: true,
      showPatientId: true,
      showDoctorName: true,
      showDoctorId: true,
      showDate: true,
      showTime: true,
      showMedicinesTable: true,
      showNotes: true,
      customFields: [],
    });
    setLogoPreview("");
    setEditingTemplate(null);
    setShowAddModal(false);
  };

  const editTemplate = (template: any) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      type: template.type,
      hospitalId: template.hospitalId || "",
      content: template.content || "",
      headerImageUrl: template.headerImageUrl || "",
      doctorLogoUrl: template.doctorLogoUrl || "",
      footerText: template.footerText || "",
      isDefault: template.isDefault,
      headerTitle: template.headerTitle || "",
      showHospitalName: template.showHospitalName !== false,
      showHospitalAddress: template.showHospitalAddress !== false,
      showHospitalPhone: template.showHospitalPhone !== false,
      showDoctorLogo: template.showDoctorLogo !== false,
      showPatientName: template.showPatientName !== false,
      showPatientId: template.showPatientId !== false,
      showDoctorName: template.showDoctorName !== false,
      showDoctorId: template.showDoctorId !== false,
      showDate: template.showDate !== false,
      showTime: template.showTime !== false,
      showMedicinesTable: template.showMedicinesTable !== false,
      showNotes: template.showNotes !== false,
      customFields: template.customFields || [],
    });
    setLogoPreview(template.doctorLogoUrl || "");
    setShowAddModal(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to server (you'll need to implement this endpoint)
      const formData = new FormData();
      formData.append('logo', file);
      
      const res = await fetch(`${API_BASE}/api/upload/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setNewTemplate((prev) => ({ ...prev, doctorLogoUrl: data.url }));
        toast.success("Logo uploaded successfully!");
      } else {
        // If upload endpoint doesn't exist, use base64 for now
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setNewTemplate((prev) => ({ ...prev, doctorLogoUrl: base64 }));
          toast.success("Logo added (using preview)");
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      // Fallback to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setNewTemplate((prev) => ({ ...prev, doctorLogoUrl: base64 }));
        setLogoPreview(base64);
        toast.success("Logo added");
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/templates/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t._id !== id));
        toast.success("Template deleted successfully!");
      } else {
        toast.error("Failed to delete template");
      }
    } catch (e) {
      toast.error("Error deleting template");
    }
  };

  const addCustomField = () => {
    setNewTemplate((prev) => ({
      ...prev,
      customFields: [...prev.customFields, { label: "", key: "", type: "text" }],
    }));
  };

  const updateCustomField = (index: number, field: string, value: any) => {
    setNewTemplate((prev) => ({
      ...prev,
      customFields: prev.customFields.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    }));
  };

  const removeCustomField = (index: number) => {
    setNewTemplate((prev) => ({
      ...prev,
      customFields: prev.customFields.filter((_, i) => i !== index),
    }));
  };

  const generatePreviewDataForTemplate = (template: any) => {
    // Generate sample data for preview based on template type
    const sampleData: Record<string, any> = {
      hospitalName: "Sample General Hospital",
      hospitalAddress: "123 Medical Street, City, State 12345",
      hospitalPhone: "+1 (555) 123-4567",
      patientName: "John Doe",
      patientId: "PAT-12345",
      doctorName: "Dr. Sarah Smith",
      doctorId: "DOC-67890",
      appointmentId: "APT-001",
      prescriptionId: "PRES-001",
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      notes: "Take with food. Complete the full course.",
      footerText: template?.footerText || newTemplate.footerText || "This is a computer-generated prescription. Please follow doctor's instructions.",
    };

    // Add sample medicines table for prescription
    if (template?.type === "PRESCRIPTION" || newTemplate.type === "PRESCRIPTION") {
      sampleData.medicines = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
          <tr style="background: #1e293b;">
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">#</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Medicine</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Dosage</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Frequency</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Duration</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #334155;">Notes</th>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #334155;">1</td>
            <td style="padding: 8px; border: 1px solid #334155;">Paracetamol 500mg</td>
            <td style="padding: 8px; border: 1px solid #334155;">1 tablet</td>
            <td style="padding: 8px; border: 1px solid #334155;">Twice daily</td>
            <td style="padding: 8px; border: 1px solid #334155;">5 days</td>
            <td style="padding: 8px; border: 1px solid #334155;">After meals</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #334155;">2</td>
            <td style="padding: 8px; border: 1px solid #334155;">Amoxicillin 250mg</td>
            <td style="padding: 8px; border: 1px solid #334155;">1 capsule</td>
            <td style="padding: 8px; border: 1px solid #334155;">Three times daily</td>
            <td style="padding: 8px; border: 1px solid #334155;">7 days</td>
            <td style="padding: 8px; border: 1px solid #334155;">With water</td>
          </tr>
        </table>
      `;
    }

    // Add default values from template variables
    const vars = template?.variables || [];
    vars.forEach((v: any) => {
      if (v.defaultValue && !sampleData[v.key]) {
        sampleData[v.key] = v.defaultValue;
      }
    });

    return sampleData;
  };

  const generatePreviewData = () => {
    return generatePreviewDataForTemplate(newTemplate);
  };

  const previewTemplate = () => {
    const generatedContent = generateTemplateContent();
    const sampleData = generatePreviewData();
    let rendered = generatedContent;

    // Replace common variables
    Object.keys(sampleData).forEach((key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      rendered = rendered.replace(regex, String(sampleData[key]));
    });

    // Replace custom field variables
    newTemplate.customFields.forEach((field) => {
      const regex = new RegExp(`\\{\\{${field.key}\\}\\}`, "g");
      rendered = rendered.replace(regex, `Sample ${field.label}`);
    });

    setPreviewContent(rendered);
    setShowPreviewModal(true);
  };

  const getDefaultContent = (type: string) => {
    const defaults: Record<string, string> = {
      PRESCRIPTION: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .hospital-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .patient-info { margin-bottom: 20px; }
    .medicines { margin-top: 20px; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="hospital-name">{{hospitalName}}</div>
    <div>Prescription</div>
  </div>
  <div class="patient-info">
    <p><strong>Patient:</strong> {{patientName}}</p>
    <p><strong>Date:</strong> {{date}}</p>
    <p><strong>Doctor:</strong> {{doctorName}}</p>
  </div>
  <div class="medicines">
    <h3>Medicines:</h3>
    {{medicines}}
  </div>
  <div class="footer">
    {{footerText}}
  </div>
</body>
</html>`,
      BILL: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .hospital-name { font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="hospital-name">{{hospitalName}}</div>
    <div>Bill/Invoice</div>
  </div>
  <p><strong>Patient:</strong> {{patientName}}</p>
  <p><strong>Date:</strong> {{date}}</p>
  <table>
    <tr>
      <th>Item</th>
      <th>Quantity</th>
      <th>Price</th>
      <th>Total</th>
    </tr>
    {{items}}
  </table>
  <p class="total">Total: {{totalAmount}}</p>
  <div class="footer">{{footerText}}</div>
</body>
</html>`,
    };
    return defaults[type] || "";
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="templates">
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-10 mb-6 sm:mb-8 bg-transparent">
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-gray-900">
                Document Templates
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Create and customize templates for prescriptions, bills, reports, and appointment letters.
              </p>
            </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-semibold text-sm shadow-sm transition-all flex items-center gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>New Template</span>
          </motion.button>
          </div>
        </div>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {templates.map((template, idx) => (
            <AnimatedCard key={template._id} delay={idx * 0.1}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-black mb-1">{template.name}</h3>
                  <span className="text-xs px-2 py-1 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 font-medium">
                    {template.type}
                  </span>
                  {template.isDefault && (
                    <span className="ml-2 text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-300 font-medium">
                      Default
                    </span>
                  )}
                </div>
              </div>
              {template.hospitalId && (
                <p className="text-xs text-black mb-2">
                  Hospital: {template.hospitalId.slice(-8)}
                </p>
              )}
              {!template.hospitalId && (
                <p className="text-xs text-black mb-2">Global Template</p>
              )}
              <div className="flex gap-2 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    // Preview existing template
                    const sampleData = generatePreviewDataForTemplate(template);
                    let rendered = template.content || "";

                    // Replace common variables
                    Object.keys(sampleData).forEach((key) => {
                      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
                      rendered = rendered.replace(regex, String(sampleData[key]));
                    });

                    setPreviewContent(rendered);
                    setShowPreviewModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 text-xs font-semibold hover:bg-blue-200 transition-all"
                >
                  👁️ Preview
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => editTemplate(template)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white border border-blue-600 text-xs font-semibold hover:bg-blue-700 transition-all"
                >
                  Edit
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => deleteTemplate(template._id)}
                  className="px-3 py-1.5 rounded-lg bg-white border-2 border-black text-black text-xs font-semibold hover:bg-black hover:text-white transition-all"
                >
                  Delete
                </motion.button>
              </div>
            </AnimatedCard>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-black">No templates found. Create your first template!</p>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-template-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border-2 border-blue-200 p-4 sm:p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 id="add-template-title" className="text-xl font-bold text-black mb-4">
              {editingTemplate ? "Edit Template" : "Create New Template"}
            </h3>
            <form onSubmit={createTemplate} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Template Name</label>
                <input
                    placeholder="Enter template name"
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-black mb-2">Template Type</label>
                <select
                    className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  value={newTemplate.type}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, type: e.target.value }))}
                  required
                >
                  <option value="PRESCRIPTION">Prescription</option>
                  <option value="BILL">Bill</option>
                  <option value="REPORT">Report</option>
                  <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                </select>
              </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-black mb-2">Hospital (Optional)</label>
              <select
                  className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                value={newTemplate.hospitalId}
                onChange={(e) => setNewTemplate((prev) => ({ ...prev, hospitalId: e.target.value }))}
              >
                <option value="">Global Template (All Hospitals)</option>
                {hospitals.map((h) => (
                  <option key={h._id} value={h._id}>
                    {h.name}
                  </option>
                ))}
              </select>
              </div>

              {/* Header Section */}
              <AnimatedCard delay={0.1} className="p-4">
                <h4 className="text-sm font-bold text-black mb-4">Header Section</h4>
                <div className="space-y-4">
                  <input
                    placeholder="Header Title (e.g., Prescription, Bill, etc.)"
                    className="w-full rounded-lg border-2 border-black px-4 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={newTemplate.headerTitle}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, headerTitle: e.target.value }))}
                  />
                  <input
                    placeholder="Header Image URL (optional)"
                    className="w-full rounded-lg border-2 border-black px-4 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={newTemplate.headerImageUrl}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, headerImageUrl: e.target.value }))}
                  />
                  
                  {/* Doctor Logo Upload Section */}
                  <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                    <h5 className="text-sm font-semibold text-black mb-3">👨‍⚕️ Doctor Logo</h5>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer mb-3">
                        <input
                          type="checkbox"
                          checked={newTemplate.showDoctorLogo}
                          onChange={(e) => setNewTemplate((prev) => ({ ...prev, showDoctorLogo: e.target.checked }))}
                          className="w-4 h-4 text-green-600 border-black rounded"
                        />
                        <span className="text-sm text-black font-medium">Show Doctor Logo</span>
                      </label>
                      
                      {newTemplate.showDoctorLogo && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <label className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                                id="logo-upload"
                              />
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm text-center cursor-pointer transition-all"
                              >
                                📤 Upload Doctor Logo
                              </motion.div>
                            </label>
                            {logoPreview && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLogoPreview("");
                                  setNewTemplate((prev) => ({ ...prev, doctorLogoUrl: "" }));
                                }}
                                className="px-3 py-2 rounded-lg bg-white border-2 border-black text-black hover:bg-black hover:text-white text-xs font-semibold"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          
                          {logoPreview && (
                            <div className="mt-3 p-3 bg-white rounded-lg border-2 border-green-200">
                              <p className="text-xs text-black mb-2 font-medium">Logo Preview:</p>
                              <img
                                src={logoPreview}
                                alt="Logo Preview"
                                className="max-w-[200px] max-h-[100px] object-contain mx-auto"
                              />
                            </div>
                          )}
                          
                          {!logoPreview && newTemplate.doctorLogoUrl && (
                            <div className="mt-3 p-3 bg-white rounded-lg border-2 border-green-200">
                              <p className="text-xs text-black mb-2 font-medium">Current Logo:</p>
                              <img
                                src={newTemplate.doctorLogoUrl}
                                alt="Current Logo"
                                className="max-w-[200px] max-h-[100px] object-contain mx-auto"
                              />
                            </div>
                          )}
                          
                          <input
                            type="text"
                            placeholder="Or enter logo URL directly"
                            className="w-full rounded-lg border-2 border-black px-4 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            value={newTemplate.doctorLogoUrl}
                            onChange={(e) => {
                              setNewTemplate((prev) => ({ ...prev, doctorLogoUrl: e.target.value }));
                              setLogoPreview(e.target.value);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showHospitalName}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showHospitalName: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Hospital Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showHospitalAddress}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showHospitalAddress: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Hospital Address</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showHospitalPhone}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showHospitalPhone: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Hospital Phone</span>
                    </label>
                  </div>
                </div>
              </AnimatedCard>

              {/* Patient & Doctor Info */}
              <AnimatedCard delay={0.2} className="p-4">
                <h4 className="text-sm font-bold text-black mb-4">Patient & Doctor Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showPatientName}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showPatientName: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Patient Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showPatientId}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showPatientId: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Patient ID</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showDoctorName}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showDoctorName: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Doctor Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showDoctorId}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showDoctorId: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show Doctor ID</span>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTemplate.showDate}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, showDate: e.target.checked }))}
                      className="w-4 h-4 text-green-600 border-black rounded"
                    />
                    <span className="text-sm text-black">Show Date</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTemplate.showTime}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, showTime: e.target.checked }))}
                      className="w-4 h-4 text-green-600 border-black rounded"
                    />
                    <span className="text-sm text-black">Show Time</span>
                  </label>
                </div>
              </AnimatedCard>

              {/* Content Sections */}
              <AnimatedCard delay={0.3} className="p-4">
                <h4 className="text-sm font-bold text-black mb-4">Content Sections</h4>
                <div className="space-y-2">
                  {(newTemplate.type === "PRESCRIPTION" || newTemplate.type === "BILL") && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTemplate.showMedicinesTable}
                        onChange={(e) => setNewTemplate((prev) => ({ ...prev, showMedicinesTable: e.target.checked }))}
                        className="w-4 h-4 text-green-600 border-black rounded"
                      />
                      <span className="text-sm text-black">Show {newTemplate.type === "PRESCRIPTION" ? "Medicines" : "Items"} Table</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                      checked={newTemplate.showNotes}
                      onChange={(e) => setNewTemplate((prev) => ({ ...prev, showNotes: e.target.checked }))}
                      className="w-4 h-4 text-green-600 border-black rounded"
                    />
                    <span className="text-sm text-black">Show Notes Section</span>
                  </label>
              </div>
              </AnimatedCard>

              {/* Custom Fields */}
              <AnimatedCard delay={0.4} className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-black">Custom Fields (Optional)</h4>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={addCustomField}
                    className="px-3 py-1 rounded-lg bg-green-600 text-white border border-green-600 text-xs font-semibold hover:bg-green-700"
                  >
                    + Add Field
                  </motion.button>
                </div>
                {newTemplate.customFields.map((field, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <input
                      placeholder="Field Label (e.g., Diagnosis)"
                      className="rounded-lg border-2 border-black px-3 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={field.label}
                      onChange={(e) => updateCustomField(idx, "label", e.target.value)}
                    />
                    <input
                      placeholder="Variable Key (e.g., diagnosis)"
                      className="rounded-lg border-2 border-black px-3 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      value={field.key}
                      onChange={(e) => updateCustomField(idx, "key", e.target.value)}
                    />
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded-lg border-2 border-black px-2 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        value={field.type}
                        onChange={(e) => updateCustomField(idx, "type", e.target.value)}
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeCustomField(idx)}
                        className="px-3 py-2 rounded-lg bg-white border-2 border-black text-black text-xs font-semibold hover:bg-black hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </AnimatedCard>

              {/* Footer */}
              <div>
                <label className="block text-sm font-semibold text-black mb-2">Footer Text (Optional)</label>
              <textarea
                  placeholder="Enter footer text (e.g., This is a computer-generated document...)"
                  className="w-full rounded-lg border-2 border-black px-4 py-2.5 text-sm text-black outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                value={newTemplate.footerText}
                onChange={(e) => setNewTemplate((prev) => ({ ...prev, footerText: e.target.value }))}
              />
              </div>

              {/* Default Template */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newTemplate.isDefault}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 text-green-600 border-black rounded"
                />
                <label className="text-sm text-black font-medium">Set as default template</label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-blue-200">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={resetForm}
                  className="flex-1 rounded-lg bg-white border-2 border-black text-black font-semibold py-2.5 text-sm transition-all hover:bg-black hover:text-white"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={previewTemplate}
                  className="px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm transition-all"
                >
                  👁️ Preview
                </motion.button>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 text-sm shadow-lg transition-all"
                >
                  {editingTemplate ? "Update" : "Create"} Template
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-template-title"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border-2 border-blue-200 p-4 sm:p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 flex-shrink-0">
              <h3 id="preview-template-title" className="text-xl sm:text-2xl font-bold text-black">Template Preview</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (printWindow) {
                      printWindow.document.write(previewContent);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all"
                >
                  🖨️ Print
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border-2 border-black text-black font-semibold text-sm transition-all hover:bg-black hover:text-white"
                >
                  ✕ Close
                </motion.button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto border-2 border-blue-200 rounded-lg bg-white">
              <div
                className="p-8"
                dangerouslySetInnerHTML={{ __html: previewContent }}
                style={{
                  fontFamily: "Arial, sans-serif",
                  minHeight: "100%",
                }}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200 flex-shrink-0">
              <p className="text-xs text-black text-center mb-2 font-medium">
                This is how the template will appear to patients when they receive their document. Review carefully before saving.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-black">
                <span>📱 Patients receive this via mobile app</span>
                <span className="hidden sm:inline">•</span>
                <span>📄 Can be downloaded/printed</span>
                <span className="hidden sm:inline">•</span>
                <span>✅ Uses template variables automatically</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}

