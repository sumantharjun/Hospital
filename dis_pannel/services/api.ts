import { API_BASE } from "@/utils/constants";
import { getAuthToken } from "@/utils/auth";

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// User API
export const userApi = {
  login: (email: string, password: string) =>
    fetch(`${API_BASE}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Login failed");
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

// Warehouse Inventory API
export const warehouseInventoryApi = {
  getAll: (distributorId: string) =>
    fetch(`${API_BASE}/api/inventory?distributorId=${distributorId}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    }),

  create: (data: any) =>
    fetch(`${API_BASE}/api/inventory`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create inventory");
      }
      return res.json();
    }),

  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/inventory/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update inventory");
      }
      return res.json();
    }),

  delete: (id: string) =>
    fetch(`${API_BASE}/api/inventory/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete inventory");
      }
      return res.json();
    }),
};

// Distributor Orders API
export const distributorOrdersApi = {
  getAll: (distributorId: string, status?: string) => {
    let url = `${API_BASE}/api/distributor-orders?distributorId=${distributorId}`;
    if (status) url += `&status=${status}`;
    console.log("Fetching distributor orders from URL:", url);
    return fetch(url, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        console.error("Failed to fetch distributor orders:", res.status, res.statusText);
        const error = await res.json().catch(() => ({}));
        console.error("Error details:", error);
        return [];
      }
      const data = await res.json();
      console.log(`Fetched ${Array.isArray(data) ? data.length : 0} orders for distributor ${distributorId}`);
      return data;
    });
  },

  getById: (id: string) =>
    fetch(`${API_BASE}/api/distributor-orders/${id}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch order");
      }
      return res.json();
    }),

  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/distributor-orders/${id}`, {
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

  assignDeliveryAgent: (orderId: string, agentId: string, agentName: string, agentPhone: string) =>
    fetch(`${API_BASE}/api/distributor-orders/${orderId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryAgentId: agentId,
        deliveryAgentName: agentName,
        deliveryAgentPhone: agentPhone,
        status: "DISPATCHED",
        pickedAt: new Date().toISOString(), // Mark as Picked when agent is assigned
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to assign delivery agent");
      }
      return res.json();
    }),
  
  markPicked: (orderId: string) =>
    fetch(`${API_BASE}/api/distributor-orders/${orderId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        pickedAt: new Date().toISOString(),
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to mark as picked");
      }
      return res.json();
    }),

  updateDeliveryStatus: (orderId: string, status: "OUT_FOR_DELIVERY" | "DELIVERED", deliveryProofImageUrl?: string) =>
    fetch(`${API_BASE}/api/distributor-orders/${orderId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        status: status === "OUT_FOR_DELIVERY" ? "DISPATCHED" : "DELIVERED",
        outForDeliveryAt: status === "OUT_FOR_DELIVERY" ? new Date().toISOString() : undefined,
        deliveredAt: status === "DELIVERED" ? new Date().toISOString() : undefined,
        deliveryProofImageUrl,
      }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update delivery status");
      }
      return res.json();
    }),
};

// Delivery Agents API
export const deliveryAgentsApi = {
  getAll: () =>
    fetch(`${API_BASE}/api/users?role=DELIVERY_AGENT`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    }),

  getAvailable: () =>
    fetch(`${API_BASE}/api/users?role=DELIVERY_AGENT&status=AVAILABLE`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    }),

  updateStatus: (agentId: string, status: string) =>
    fetch(`${API_BASE}/api/users/${agentId}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update agent status");
      }
      return res.json();
    }),
};

// Notifications API
export const notificationsApi = {
  getMyNotifications: () =>
    fetch(`${API_BASE}/api/notifications/my`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) return [];
      return res.json();
    }),

  markAsRead: (notificationId: string) =>
    fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to mark notification as read");
      }
      return res.json();
    }),
};

// Distributor API
export const distributorApi = {
  getById: (id: string) =>
    fetch(`${API_BASE}/api/master/distributors/${id}`, {
      headers: getAuthHeaders(),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to fetch distributor");
      }
      return res.json();
    }),

  update: (id: string, data: any) =>
    fetch(`${API_BASE}/api/master/distributors/${id}`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update distributor");
      }
      return res.json();
    }),
};

