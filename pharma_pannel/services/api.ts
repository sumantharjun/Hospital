import { API_BASE } from "@/utils/constants";
import { getAuthToken } from "@/utils/auth";

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Inventory API
export const inventoryApi = {
  getAll: async (pharmacyId: string) => {
    try {
      console.log(`📋 Fetching inventory for pharmacy: ${pharmacyId}`);
      const response = await fetch(`${API_BASE}/api/inventory/by-pharmacy/${pharmacyId}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        console.error("❌ Error fetching inventory:", error);
        throw new Error(error.message || "Failed to fetch inventory");
      }
      
      const data = await response.json();
      console.log(`✅ Fetched ${Array.isArray(data) ? data.length : 0} inventory items`);
      if (Array.isArray(data) && data.length > 0) {
        console.log("Sample items:", data.slice(0, 3).map((item: any) => ({ 
          medicineName: item.medicineName, 
          category: item.category, 
          quantity: item.quantity 
        })));
      }
      return data;
    } catch (error: any) {
      console.error("❌ Error in inventoryApi.getAll:", error);
      throw error;
    }
  },
  
  getLowStock: (pharmacyId: string) =>
    fetch(`${API_BASE}/api/inventory/by-pharmacy/${pharmacyId}?lowStock=true`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
  
  create: async (data: any) => {
    const response = await fetch(`${API_BASE}/api/inventory`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
      console.error("Error creating inventory item:", error);
      throw new Error(error.message || "Failed to create inventory item");
    }
    
    return await response.json();
  },
  
  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/inventory/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
  
  delete: (id: string) =>
    fetch(`${API_BASE}/api/inventory/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
  
  consume: (id: string, quantity: number) =>
    fetch(`${API_BASE}/api/inventory/${id}/consume`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }).then((res) => res.json()),
};

// Orders API
export const ordersApi = {
  getByPharmacy: (pharmacyId: string) =>
    fetch(`${API_BASE}/api/orders/by-pharmacy/${pharmacyId}`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
  
  updateStatus: (id: string, data: any) =>
    fetch(`${API_BASE}/api/orders/${id}/status`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update order status");
      }
      return res.json();
    }),
  
  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/orders/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update order");
      }
      return res.json();
    }),
  
  getById: (id: string) =>
    fetch(`${API_BASE}/api/orders/${id}`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
};

// Prescriptions API
export const prescriptionsApi = {
  getByPharmacy: (pharmacyId: string) =>
    fetch(`${API_BASE}/api/prescriptions/by-pharmacy/${pharmacyId}`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
  
  getById: (id: string) =>
    fetch(`${API_BASE}/api/prescriptions/${id}`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
};

// Distributor Orders API
export const distributorOrdersApi = {
  getAll: async (pharmacyId: string) => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/distributor-orders?pharmacyId=${pharmacyId}`, {
        headers: headers,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(error.message || "Failed to fetch distributor orders");
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error("Error fetching distributor orders:", error);
      throw error;
    }
  },
  
  create: (data: any) =>
    fetch(`${API_BASE}/api/distributor-orders`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create distributor order");
      }
      return res.json();
    }),
  
  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/distributor-orders/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
};

// Pharmacy API
export const pharmacyApi = {
  getById: (id: string) =>
    fetch(`${API_BASE}/api/master/pharmacies/${id}`, {
      headers: getAuthHeaders(),
    }).then((res) => res.json()),
  
  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/master/pharmacies/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => res.json()),
};

// Master/Distributors API
export const distributorsApi = {
  getAll: async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/master/distributors`, {
        headers: headers,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: `HTTP ${response.status}: ${response.statusText}` }));
        throw new Error(error.message || "Failed to fetch distributors");
      }
      
      return await response.json();
    } catch (error: any) {
      // Handle network errors
      if (error.name === "TypeError" || error.message === "Failed to fetch") {
        throw new Error(`Cannot connect to server. Please check if the backend is running at ${API_BASE}`);
      }
      throw error;
    }
  },
};

// User API
export const userApi = {
  /** Login with email or mobile number + password */
  login: (emailOrPhone: string, password: string) => {
    const isEmail = emailOrPhone.includes("@");
    const body = isEmail
      ? { email: emailOrPhone.trim().toLowerCase(), password }
      : { phone: emailOrPhone.trim(), password };
    return fetch(`${API_BASE}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Login failed");
      }
      return res.json();
    });
  },

  sendOtp: (phone: string) =>
    fetch(`${API_BASE}/api/users/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to send OTP");
      }
      return res.json();
    }),

  verifyOtp: (phone: string, otp: string) =>
    fetch(`${API_BASE}/api/users/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Invalid OTP");
      }
      return res.json();
    }),
  
  getProfile: () =>
    fetch(`${API_BASE}/api/users/profile`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    }),
  
  updateProfile: (data: any) =>
    fetch(`${API_BASE}/api/users/profile`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update profile");
      }
      return res.json();
    }),
};

// Delivery Agent API
export const deliveryAgentApi = {
  getAvailableAgents: () =>
    fetch(`${API_BASE}/api/users?role=DELIVERY_AGENT&status=AVAILABLE`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    }),
  
  getByPharmacy: (pharmacyId: string) =>
    fetch(`${API_BASE}/api/users?role=DELIVERY_AGENT&pharmacyId=${pharmacyId}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      const users = await res.json();
      // Format to match expected structure
      return Array.isArray(users) ? users.map((u: any) => ({
        _id: u._id || u.id,
        name: u.name,
        phoneNumber: u.phone || u.phoneNumber,
        email: u.email,
        status: u.status || "AVAILABLE",
        pharmacyId: u.pharmacyId,
      })) : [];
    }),
  
  create: (data: any) =>
    fetch(`${API_BASE}/api/users/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email || `${data.name.toLowerCase().replace(/\s+/g, '.')}@delivery.local`,
        password: data.password || "delivery123", // Default password
        role: "DELIVERY_AGENT",
        phone: data.phoneNumber,
        pharmacyId: data.pharmacyId,
        status: data.status || "AVAILABLE",
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create delivery agent");
      }
      const user = await res.json();
      // Format to match expected structure
      return {
        _id: user._id || user.id,
        name: user.name,
        phoneNumber: user.phone || data.phoneNumber,
        email: user.email,
        status: user.status || "AVAILABLE",
        pharmacyId: user.pharmacyId,
      };
    }),
  
  update: (id: string, data: any) => {
    // Only include fields that are provided (not undefined)
    const updateBody: any = {};
    if (data.name !== undefined) updateBody.name = data.name;
    if (data.phoneNumber !== undefined) updateBody.phone = data.phoneNumber;
    if (data.email !== undefined) updateBody.email = data.email;
    if (data.status !== undefined) updateBody.status = data.status;
    
    return fetch(`${API_BASE}/api/users/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(updateBody),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update delivery agent");
      }
      const user = await res.json();
      // Format to match expected structure
      return {
        _id: user._id || user.id,
        name: user.name,
        phoneNumber: user.phone || data.phoneNumber,
        email: user.email,
        status: user.status || "AVAILABLE",
        pharmacyId: user.pharmacyId,
      };
    });
  },
  
  delete: (id: string) =>
    fetch(`${API_BASE}/api/users/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete delivery agent");
      }
      return res.json();
    }),
  
  assignToOrder: (orderId: string, agentId: string, agentName: string, agentPhone: string, estimatedTime?: string) =>
    fetch(`${API_BASE}/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "OUT_FOR_DELIVERY",
        deliveryPersonId: agentId,
        deliveryPersonName: agentName,
        deliveryPersonPhone: agentPhone,
        estimatedDeliveryTime: estimatedTime,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to assign delivery agent");
      }
      return res.json();
    }),
  
  // Auto-assign available agent to order
  autoAssign: (orderId: string, pharmacyId: string) =>
    fetch(`${API_BASE}/api/orders/${orderId}/auto-assign-agent`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ pharmacyId }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to auto-assign delivery agent");
      }
      return res.json();
    }),
};

// Reports API
export const reportsApi = {
  getOrderHistory: (pharmacyId: string, startDate?: string, endDate?: string) => {
    let url = `${API_BASE}/api/orders/by-pharmacy/${pharmacyId}`;
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (params.toString()) url += `?${params.toString()}`;
    
    return fetch(url, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    });
  },
  
  downloadReport: async (pharmacyId: string, type: "orders" | "inventory" | "prescriptions", startDate?: string, endDate?: string) => {
    const data = await reportsApi.getOrderHistory(pharmacyId, startDate, endDate);
    
    // Convert to CSV
    if (type === "orders" && data.length > 0) {
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map((item: any) => Object.values(item).join(","));
      const csv = [headers, ...rows].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pharmacy-orders-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  },
};

// Pharmacy Invoice API
export const pharmacyInvoiceApi = {
  create: (data: any & { overrideExpiry?: boolean }) =>
    fetch(`${API_BASE}/api/pharmacy-invoices`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      const error = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error((error as any).message || "Failed to create invoice");
        (err as any).code = (error as any).code;
        (err as any).response = res;
        throw err;
      }
      return res.json();
    }),

  getAll: (pharmacyId?: string, filters?: any) => {
    let url = `${API_BASE}/api/pharmacy-invoices`;
    const params = new URLSearchParams();
    if (pharmacyId) params.append("pharmacyId", pharmacyId);
    if (filters?.patientId) params.append("patientId", filters.patientId);
    if (filters?.orderId) params.append("orderId", filters.orderId);
    if (filters?.invoiceType) params.append("invoiceType", filters.invoiceType);
    if (filters?.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (params.toString()) url += `?${params.toString()}`;

    return fetch(url, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch invoices");
      }
      return res.json();
    });
  },

  getById: (id: string) =>
    fetch(`${API_BASE}/api/pharmacy-invoices/${id}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch invoice");
      }
      return res.json();
    }),

  updatePayment: (id: string, data: any) =>
    fetch(`${API_BASE}/api/pharmacy-invoices/${id}/payment`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update payment");
      }
      return res.json();
    }),

  downloadPDF: async (id: string) => {
    const token = getAuthToken();
    if (!token) throw new Error("Please login to download invoice");

    const response = await fetch(`${API_BASE}/api/pharmacy-invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to generate invoice PDF");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy-invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// Inventory Search API (Smart Medicine Search)
export const inventorySearchApi = {
  search: (pharmacyId: string, query: string) => {
    const params = new URLSearchParams({ pharmacyId, query });
    return fetch(`${API_BASE}/api/inventory/search?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to search medicines");
      }
      return res.json();
    });
  },

  getBrandsByComposition: (pharmacyId: string, composition: string) => {
    const params = new URLSearchParams({ pharmacyId, composition });
    return fetch(`${API_BASE}/api/inventory/brands-by-composition?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch brands");
      }
      return res.json();
    });
  },

  getExpiryRisk: (pharmacyId: string, days: number = 30) => {
    const params = new URLSearchParams({ pharmacyId, days: days.toString() });
    return fetch(`${API_BASE}/api/inventory/expiry-risk?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch expiry risk items");
      }
      return res.json();
    });
  },
};

// Audit API
export const auditApi = {
  createDaily: (data: any) => {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${API_BASE}/api/audits/daily`, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          const errorMessage = error.message || error.error || `Failed to create audit (${res.status})`;
          // Silent error handling - errors are shown only as toasts
          // Create a proper Error object
          const apiError = new Error(errorMessage);
          (apiError as any).response = res;
          (apiError as any).data = error;
          reject(apiError);
          return;
        }
        
        const result = await res.json();
        resolve(result);
      } catch (error: any) {
        // Ensure error is properly formatted
        if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error(error?.message || "Failed to create audit"));
        }
      }
    });
  },

  getAll: (pharmacyId?: string, filters?: any) => {
    let url = `${API_BASE}/api/audits`;
    const params = new URLSearchParams();
    if (pharmacyId) params.append("pharmacyId", pharmacyId);
    if (filters?.auditType) params.append("auditType", filters.auditType);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (params.toString()) url += `?${params.toString()}`;

    return fetch(url, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch audits");
      }
      return res.json();
    });
  },

  getById: (id: string) =>
    fetch(`${API_BASE}/api/audits/${id}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch audit");
      }
      return res.json();
    }),

  updateClosingStock: (id: string, items: any[]) =>
    fetch(`${API_BASE}/api/audits/${id}/closing-stock`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update closing stock");
      }
      return res.json();
    }),

  updateManualBills: (id: string, items: any[]) =>
    fetch(`${API_BASE}/api/audits/${id}/manual-bills`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update manual bills");
      }
      return res.json();
    }),

  review: (id: string, notes?: string) =>
    fetch(`${API_BASE}/api/audits/${id}/review`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ reviewedNotes: notes }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to review audit");
      }
      return res.json();
    }),

  downloadReport: async (id: string) => {
    const token = getAuthToken();
    if (!token) throw new Error("Please login to download audit report");
    const res = await fetch(`${API_BASE}/api/audits/${id}/export?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Failed to download report");
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },
};

// Pharmacy Reports API
export const pharmacyReportsApi = {
  getExpiryTracking: (pharmacyId: string, days: number = 90, expiredOnly: boolean = false) => {
    const params = new URLSearchParams({ pharmacyId, days: days.toString(), expiredOnly: expiredOnly.toString() });
    return fetch(`${API_BASE}/api/reports/pharmacy/expiry-tracking?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch expiry tracking report");
      }
      return res.json();
    });
  },

  getBrandMargin: (pharmacyId: string, startDate?: string, endDate?: string, composition?: string) => {
    const params = new URLSearchParams({ pharmacyId });
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (composition) params.append("composition", composition);
    return fetch(`${API_BASE}/api/reports/pharmacy/brand-margin?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch brand margin report");
      }
      return res.json();
    });
  },

  getBatchAging: (pharmacyId: string) => {
    const params = new URLSearchParams({ pharmacyId });
    return fetch(`${API_BASE}/api/reports/pharmacy/batch-aging?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch batch aging report");
      }
      return res.json();
    });
  },

  getAuditMismatches: (pharmacyId?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (pharmacyId) params.append("pharmacyId", pharmacyId);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return fetch(`${API_BASE}/api/reports/pharmacy/audit-mismatches?${params}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch audit mismatches");
      }
      return res.json();
    });
  },
};

