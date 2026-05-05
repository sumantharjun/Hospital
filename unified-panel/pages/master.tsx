import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import AnimatedCard from "../components/AnimatedCard";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;

export default function MasterPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newHospital, setNewHospital] = useState({ name: "", address: "", phone: "" });
  const [newPharmacy, setNewPharmacy] = useState({ name: "", address: "", phone: "" });
  const [newDistributor, setNewDistributor] = useState({ name: "", address: "", phone: "" });
  
  const [editingHospital, setEditingHospital] = useState<any>(null);
  const [editingPharmacy, setEditingPharmacy] = useState<any>(null);
  const [editingDistributor, setEditingDistributor] = useState<any>(null);

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
        const [hRes, pRes, dRes] = await Promise.all([
          fetch(`${API_BASE}/api/master/hospitals`, { headers }),
          fetch(`${API_BASE}/api/master/pharmacies`, { headers }),
          fetch(`${API_BASE}/api/master/distributors`, { headers }),
        ]);
        setHospitals(hRes.ok ? await hRes.json() : []);
        setPharmacies(pRes.ok ? await pRes.json() : []);
        setDistributors(dRes.ok ? await dRes.json() : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const createHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const url = editingHospital
        ? `${API_BASE}/api/master/hospitals/${editingHospital._id}`
        : `${API_BASE}/api/master/hospitals`;
      const method = editingHospital ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newHospital),
      });
      if (res.ok) {
        const created = await res.json();
        if (editingHospital) {
          setHospitals((prev) => prev.map((h) => (h._id === editingHospital._id ? created : h)));
          setEditingHospital(null);
        } else {
          setHospitals((prev) => [created, ...prev]);
        }
        setNewHospital({ name: "", address: "", phone: "" });
        toast.success(`Hospital ${editingHospital ? "updated" : "created"} successfully!`);
      } else {
        toast.error(`Failed to ${editingHospital ? "update" : "create"} hospital`);
      }
    } catch (e) {
      toast.error(`Error ${editingHospital ? "updating" : "creating"} hospital`);
    }
  };

  const editHospital = (hospital: any) => {
    setEditingHospital(hospital);
    setNewHospital({ name: hospital.name, address: hospital.address, phone: hospital.phone || "" });
  };

  const deleteHospital = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/hospitals/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setHospitals((prev) => prev.filter((h) => h._id !== id));
        toast.success("Hospital deleted successfully!");
      } else {
        toast.error("Failed to delete hospital");
      }
    } catch (e) {
      toast.error("Error deleting hospital");
    }
  };

  const createPharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const url = editingPharmacy
        ? `${API_BASE}/api/master/pharmacies/${editingPharmacy._id}`
        : `${API_BASE}/api/master/pharmacies`;
      const method = editingPharmacy ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newPharmacy),
      });
      if (res.ok) {
        const created = await res.json();
        if (editingPharmacy) {
          setPharmacies((prev) => prev.map((p) => (p._id === editingPharmacy._id ? created : p)));
          setEditingPharmacy(null);
        } else {
          setPharmacies((prev) => [created, ...prev]);
        }
        setNewPharmacy({ name: "", address: "", phone: "" });
        toast.success(`Pharmacy ${editingPharmacy ? "updated" : "created"} successfully!`);
      } else {
        toast.error(`Failed to ${editingPharmacy ? "update" : "create"} pharmacy`);
      }
    } catch (e) {
      toast.error(`Error ${editingPharmacy ? "updating" : "creating"} pharmacy`);
    }
  };

  const editPharmacy = (pharmacy: any) => {
    setEditingPharmacy(pharmacy);
    setNewPharmacy({ name: pharmacy.name, address: pharmacy.address, phone: pharmacy.phone || "" });
  };

  const deletePharmacy = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/pharmacies/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setPharmacies((prev) => prev.filter((p) => p._id !== id));
        toast.success("Pharmacy deleted successfully!");
      } else {
        toast.error("Failed to delete pharmacy");
      }
    } catch (e) {
      toast.error("Error deleting pharmacy");
    }
  };

  const createDistributor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const url = editingDistributor
        ? `${API_BASE}/api/master/distributors/${editingDistributor._id}`
        : `${API_BASE}/api/master/distributors`;
      const method = editingDistributor ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newDistributor),
      });
      if (res.ok) {
        const created = await res.json();
        if (editingDistributor) {
          setDistributors((prev) => prev.map((d) => (d._id === editingDistributor._id ? created : d)));
          setEditingDistributor(null);
        } else {
          setDistributors((prev) => [created, ...prev]);
        }
        setNewDistributor({ name: "", address: "", phone: "" });
        toast.success(`Distributor ${editingDistributor ? "updated" : "created"} successfully!`);
      } else {
        toast.error(`Failed to ${editingDistributor ? "update" : "create"} distributor`);
      }
    } catch (e) {
      toast.error(`Error ${editingDistributor ? "updating" : "creating"} distributor`);
    }
  };

  const editDistributor = (distributor: any) => {
    setEditingDistributor(distributor);
    setNewDistributor({ name: distributor.name, address: distributor.address, phone: distributor.phone || "" });
  };

  const deleteDistributor = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/master/distributors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setDistributors((prev) => prev.filter((d) => d._id !== id));
        toast.success("Distributor deleted successfully!");
      } else {
        toast.error("Failed to delete distributor");
      }
    } catch (e) {
      toast.error("Error deleting distributor");
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} currentPage="master">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 sm:mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-black">
          Master Data Overview
        </h2>
        <p className="text-sm text-gray-600">
          Overview of hospitals, pharmacies, and distributors in the ecosystem.
        </p>
      </motion.header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Hospital Overview Card */}
          <AnimatedCard delay={0.1}>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-3xl shadow-lg">
                🏥
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-black mb-1">Hospitals</h3>
                <p className="text-sm text-gray-600">{hospitals.length} registered</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Total hospitals in the system
            </p>
          </AnimatedCard>

          {/* Pharmacy Overview Card */}
          <AnimatedCard delay={0.2}>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-3xl shadow-lg">
                💊
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-black mb-1">Pharmacies</h3>
                <p className="text-sm text-gray-600">{pharmacies.length} registered</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Total pharmacies in the system
            </p>
          </AnimatedCard>

          {/* Distributor Overview Card */}
          <AnimatedCard delay={0.3}>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center text-3xl shadow-lg">
                🚚
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-black mb-1">Distributors</h3>
                <p className="text-sm text-gray-600">{distributors.length} registered</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Total distributors in the system
            </p>
          </AnimatedCard>
        </div>
      )}
    </Layout>
  );
}
