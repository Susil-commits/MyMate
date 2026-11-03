import React, { useState, useEffect, FormEvent } from "react";
import {
  HiOfficeBuilding,
  HiReceiptTax,
  HiUserGroup,
  HiPlus,
  HiCheckCircle,
  HiPrinter,
  HiMail,
  HiPhone,
  HiLocationMarker,
  HiCurrencyRupee,
  HiShieldCheck,
  HiTrendingUp,
  HiTrash,
  HiInformationCircle,
  HiCalendar,
} from "react-icons/hi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import BackButton from "../components/BackButton";
import { formatINR } from "../utils/constants";

interface Organization {
  id: string;
  name: string;
  gstin: string;
  billingEmail: string;
  phone: string;
  address: string;
  monthlyBudget: number;
  currentMonthSpend: number;
  costCenters: string[];
  adminUser: string;
  members: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface MonthlyTaxInvoice {
  invoiceNumber: string;
  billingMonth: string;
  organization: string;
  gstin: string;
  billingEmail: string;
  address: string;
  providerName?: string;
  providerGstin?: string;
  providerPan?: string;
  providerAddress?: string;
  sacCode?: string;
  totalTrips: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  totalAmountINR: number;
  currency: string;
  generatedAt: string;
}

interface MemberProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  locality?: string;
  avatar?: string;
  isAdmin: boolean;
  createdAt?: string;
}

interface ShiftRoster {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar?: string;
  driverPhone?: string;
  title: string;
  costCenter: string;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  daysOfWeek: string[];
  dailyRate: number;
  totalEstimatedDays: number;
  totalAmount: number;
  status: "confirmed" | "active" | "completed" | "cancelled";
  pickupLocation: string;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function CorporateFleetPage(): React.ReactElement {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [membersList, setMembersList] = useState<MemberProfile[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "roster" | "shifts" | "invoices">("overview");

  // Shifts state
  const [shifts, setShifts] = useState<ShiftRoster[]>([]);
  const [loadingShifts, setLoadingShifts] = useState<boolean>(false);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [shiftForm, setShiftForm] = useState({
    driverId: "",
    title: "Executive Daily Chauffeur",
    costCenter: "Executive",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    dailyStartTime: "09:00",
    dailyEndTime: "18:00",
    daysOfWeek: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    pickupLocation: "",
  });
  const [schedulingShift, setSchedulingShift] = useState<boolean>(false);

  // Registration form state
  const [regForm, setRegForm] = useState({
    name: "",
    gstin: "",
    billingEmail: user?.email || "",
    phone: user?.phone || "",
    address: "",
    monthlyBudget: "50000",
    costCenters: ["Executive", "Operations", "Sales", "Field Logistics"],
  });
  const [newCostCenter, setNewCostCenter] = useState<string>("");
  const [registering, setRegistering] = useState<boolean>(false);

  // Add Member state
  const [newMemberEmail, setNewMemberEmail] = useState<string>("");
  const [addingMember, setAddingMember] = useState<boolean>(false);

  // Invoicing state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });
  const [invoice, setInvoice] = useState<MonthlyTaxInvoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState<boolean>(false);

  const fetchOrganization = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/corporate/organization");
      if (data && data.organization) {
        setOrg(data.organization);
        setMembersList(data.membersList || []);
      } else {
        setOrg(null);
        setMembersList([]);
      }
    } catch (err: unknown) {
      // 404 indicates user has no registered corporate account yet
      setOrg(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, []);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const cleanGSTIN = regForm.gstin.trim().toUpperCase();

    if (!GSTIN_REGEX.test(cleanGSTIN)) {
      toast.error("Please enter a valid 15-character Indian GSTIN (e.g. 27AAAAA0000A1Z5)");
      return;
    }

    if (!regForm.name.trim() || !regForm.billingEmail.trim() || !regForm.address.trim()) {
      toast.error("Please fill in all mandatory corporate profile fields");
      return;
    }

    setRegistering(true);
    try {
      const payload = {
        name: regForm.name.trim(),
        gstin: cleanGSTIN,
        billingEmail: regForm.billingEmail.trim().toLowerCase(),
        phone: regForm.phone.trim(),
        address: regForm.address.trim(),
        monthlyBudget: parseFloat(regForm.monthlyBudget) || 0,
        costCenters: regForm.costCenters,
      };

      const { data } = await api.post("/corporate/organization", payload);
      toast.success(data.message || "Corporate organization registered successfully!");
      if (data.organization) {
        setOrg(data.organization);
      } else {
        await fetchOrganization();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to register corporate account";
      toast.error(msg);
    } finally {
      setRegistering(false);
    }
  };

  const handleAddCostCenter = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const tag = newCostCenter.trim();
    if (tag && !regForm.costCenters.includes(tag)) {
      setRegForm((prev) => ({ ...prev, costCenters: [...prev.costCenters, tag] }));
      setNewCostCenter("");
    }
  };

  const handleRemoveCostCenter = (tag: string) => {
    setRegForm((prev) => ({
      ...prev,
      costCenters: prev.costCenters.filter((c) => c !== tag),
    }));
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    const email = newMemberEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Please enter an employee email");
      return;
    }

    setAddingMember(true);
    try {
      const { data } = await api.post("/corporate/organization/members", { email });
      toast.success(data.message || "Employee successfully enrolled!");
      setNewMemberEmail("");
      await fetchOrganization();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to add employee";
      toast.error(msg);
    } finally {
      setAddingMember(false);
    }
  };

  const handleFetchInvoice = async () => {
    setLoadingInvoice(true);
    try {
      const { data } = await api.get(`/corporate/organization/invoice?month=${selectedMonth}`);
      setInvoice(data);
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to load tax invoice";
      toast.error(msg);
    } finally {
      setLoadingInvoice(false);
    }
  };

  useEffect(() => {
    if (org && activeTab === "invoices") {
      handleFetchInvoice();
    }
  }, [org, activeTab, selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const fetchShifts = async () => {
    setLoadingShifts(true);
    try {
      const { data } = await api.get("/corporate/organization/shifts");
      setShifts(data.shifts || []);
    } catch (err: any) {
      console.error("Failed to load shifts:", err);
    } finally {
      setLoadingShifts(false);
    }
  };

  const loadDriversForShift = async () => {
    try {
      const { data } = await api.get("/drivers?limit=20");
      setAvailableDrivers(data.drivers || []);
      if (data.drivers?.length > 0 && !shiftForm.driverId) {
        const first = data.drivers[0];
        setShiftForm((prev) => ({ ...prev, driverId: first._id || first.id }));
      }
    } catch {
      // Non-fatal
    }
  };

  useEffect(() => {
    if (org && activeTab === "shifts") {
      fetchShifts();
      loadDriversForShift();
    }
  }, [org, activeTab]);

  const handleCreateShift = async (e: FormEvent) => {
    e.preventDefault();
    if (!shiftForm.driverId || !shiftForm.pickupLocation.trim()) {
      toast.error("Please select a driver and specify pickup location");
      return;
    }

    setSchedulingShift(true);
    try {
      const { data } = await api.post("/corporate/organization/shifts", shiftForm);
      toast.success(data.message || "Chauffeur shift scheduled successfully!");
      setShowShiftModal(false);
      await fetchShifts();
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to schedule shift";
      toast.error(msg);
    } finally {
      setSchedulingShift(false);
    }
  };

  const handleCancelShift = async (shiftId: string) => {
    try {
      await api.put(`/corporate/organization/shifts/${shiftId}/cancel`);
      toast.success("Shift cancelled and driver slot released");
      await fetchShifts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to cancel shift");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading corporate profile...</p>
      </div>
    );
  }

  // Not enrolled yet -> Render Onboarding view
  if (!org) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12">
        <BackButton to="/profile" label="Back to Profile" />

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 p-8 sm:p-12 text-white shadow-2xl">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
              <HiShieldCheck className="w-4 h-4 text-blue-400" />
              Enterprise Fleet Solution
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              MyMate Corporate B2B Fleet Portal
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Consolidate employee mobility under your company's GSTIN. Gain 18% Input Tax Credit
              (ITC), departmental cost center attribution, budget guardrails, and single-click monthly tax invoices.
            </p>
          </div>
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <HiOfficeBuilding className="w-96 h-96 text-white" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 sm:p-10">
          <div className="border-b border-gray-100 dark:border-gray-800 pb-5 mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <HiOfficeBuilding className="w-6 h-6 text-blue-600" />
              Register Corporate Account
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Provide your organization details and GSTIN to activate centralized corporate billing.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Company Legal Entity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Technologies Pvt Ltd"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  15-Digit Indian GSTIN *
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  value={regForm.gstin}
                  onChange={(e) => setRegForm({ ...regForm, gstin: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white uppercase font-mono focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Format: 2-digit State code + 10-char PAN + 1 Entity code + 'Z' + 1 Checksum
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Official Billing Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="accounts@company.com"
                  value={regForm.billingEmail}
                  onChange={(e) => setRegForm({ ...regForm, billingEmail: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Billing Contact Phone *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Registered Corporate Address (For Tax Invoices) *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Plot 42, Cyber City, Phase 2, Gurugram, Haryana - 122002"
                  value={regForm.address}
                  onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Monthly Fleet Spending Budget (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    placeholder="50000"
                    value={regForm.monthlyBudget}
                    onChange={(e) => setRegForm({ ...regForm, monthlyBudget: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                  Department Cost Centers
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Engineering"
                    value={newCostCenter}
                    onChange={(e) => setNewCostCenter(e.target.value)}
                    onKeyDown={handleAddCostCenter}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddCostCenter}
                    className="px-4 py-2.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {regForm.costCenters.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    >
                      {tag}
                      {regForm.costCenters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCostCenter(tag)}
                          className="hover:text-red-500 cursor-pointer ml-1"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                type="submit"
                disabled={registering}
                className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition disabled:opacity-50 cursor-pointer"
              >
                {registering ? "Registering Organization..." : "Activate Corporate Account"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Enrolled Corporate Dashboard View
  const budget = org.monthlyBudget || 0;
  const spend = org.currentMonthSpend || 0;
  const spendPercent = budget > 0 ? Math.min(100, Math.round((spend / budget) * 100)) : 0;
  const remainingBudget = Math.max(0, budget - spend);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      <BackButton to="/profile" label="Back to Profile" />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{org.name}</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <HiShieldCheck className="w-4 h-4" />
                GSTIN Verified
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              <span className="font-mono bg-white/10 px-2.5 py-1 rounded-md">
                GSTIN: {org.gstin}
              </span>
              <span className="flex items-center gap-1">
                <HiMail className="w-4 h-4 text-blue-400" />
                {org.billingEmail}
              </span>
              <span className="flex items-center gap-1">
                <HiPhone className="w-4 h-4 text-blue-400" />
                {org.phone}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <HiLocationMarker className="w-4 h-4 text-slate-400 flex-shrink-0" />
              {org.address}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("invoices")}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <HiReceiptTax className="w-4 h-4" />
              Monthly Tax Invoices
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 cursor-pointer ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <HiTrendingUp className="w-4 h-4" />
          Budget & Overview
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 cursor-pointer ${
            activeTab === "roster"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <HiUserGroup className="w-4 h-4" />
          Employee Roster ({org.members?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("shifts")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 cursor-pointer ${
            activeTab === "shifts"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <HiCalendar className="w-4 h-4" />
          Chauffeur Shifts ({shifts.length})
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 transition border-b-2 cursor-pointer ${
            activeTab === "invoices"
              ? "border-blue-600 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          <HiReceiptTax className="w-4 h-4" />
          GST Tax Invoices
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Monthly Fleet Cap
              </span>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                {formatINR(budget)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Configured spending threshold</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Current Month Spend
              </span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
                {formatINR(spend)}
              </p>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-3 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    spendPercent > 90
                      ? "bg-red-500"
                      : spendPercent > 70
                      ? "bg-amber-500"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${spendPercent}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{spendPercent}% of cap utilized</p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Available Budget
              </span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {formatINR(remainingBudget)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Remaining for current billing cycle</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
              Department Cost Centers
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Corporate drivers booked by authorized team members are tagged with these cost centers
              for analytical departmental audit.
            </p>
            <div className="flex flex-wrap gap-2">
              {org.costCenters?.map((cc) => (
                <span
                  key={cc}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium"
                >
                  {cc}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 flex items-start gap-4">
            <HiInformationCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
              <p className="font-semibold text-blue-900 dark:text-blue-300">
                Automatic Indian GST Compliance
              </p>
              <p>
                All rides taken by your registered employee roster are integrated into your monthly
                tax invoice with SAC code 9964. The 18% Integrated GST (9% CGST + 9% SGST) can be
                directly claimed by your accounting department as Input Tax Credit (ITC).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employee Roster */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
              Add Corporate Member
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Enter the email address of any employee registered on MyMate to link them to this
              corporate account.
            </p>

            <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
              <button
                type="submit"
                disabled={addingMember}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <HiPlus className="w-4 h-4" />
                {addingMember ? "Adding..." : "Add to Fleet"}
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Authorized Corporate Roster ({org.members?.length || 0})
              </h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {membersList.length > 0 ? (
                membersList.map((member, idx) => (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                          {member.name ? member.name.charAt(0).toUpperCase() : `#${idx + 1}`}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {member.name || `Member #${idx + 1}`}
                          </p>
                          {member.locality && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                              {member.locality}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                          <span>{member.email}</span>
                          {member.phone && <span>• {member.phone}</span>}
                        </div>
                      </div>
                    </div>
                    <div>
                      {member.isAdmin ? (
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Active Member
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                org.members?.map((memberId, idx) => {
                  const isAdmin = memberId === org.adminUser;
                  return (
                    <div key={memberId} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                            User ID: {memberId}
                          </p>
                          <p className="text-xs text-gray-400">
                            {isAdmin ? "Account Administrator (Full Access)" : "Authorized Corporate Passenger"}
                          </p>
                        </div>
                      </div>
                      <div>
                        {isAdmin ? (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Admin
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Active Member
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Chauffeur Shifts Rostering */}
      {activeTab === "shifts" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Scheduled Chauffeur Rosters
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Dedicated driver assignments with automatic conflict detection and multi-day recurring dispatch.
              </p>
            </div>
            <button
              onClick={() => setShowShiftModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <HiPlus className="w-4 h-4" />
              Schedule Chauffeur
            </button>
          </div>

          {loadingShifts ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-xs text-gray-500">Loading corporate roster...</p>
            </div>
          ) : shifts.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center space-y-3">
              <HiCalendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                No Chauffeur Shifts Scheduled Yet
              </p>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Schedule recurring multi-day drivers for executives, sales roadshows, or departmental logistics.
              </p>
              <button
                onClick={() => setShowShiftModal(true)}
                className="mt-2 px-4 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                + Schedule First Shift
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {s.driverAvatar ? (
                        <img
                          src={s.driverAvatar}
                          alt={s.driverName}
                          className="w-11 h-11 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                          {s.driverName.charAt(0)}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                          {s.driverName}
                        </h4>
                        <p className="text-xs text-gray-400">{s.title}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                        s.status === "confirmed"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : s.status === "active"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl">
                    <div>
                      <span className="text-gray-400 block text-[11px]">DATE WINDOW</span>
                      <strong className="text-gray-900 dark:text-white">
                        {new Date(s.startDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        –{" "}
                        {new Date(s.endDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">DAILY HOURS</span>
                      <strong className="text-gray-900 dark:text-white">
                        {s.dailyStartTime} – {s.dailyEndTime}
                      </strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-gray-500">
                      Cost Center: <strong className="text-blue-600">{s.costCenter}</strong>
                    </span>
                    <span className="font-extrabold text-gray-900 dark:text-white text-sm">
                      {formatINR(s.totalAmount)}{" "}
                      <span className="text-[11px] font-normal text-gray-400">
                        ({s.totalEstimatedDays} days)
                      </span>
                    </span>
                  </div>

                  {s.status === "confirmed" && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleCancelShift(s.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                      >
                        Cancel Shift & Release Slot
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Schedule Chauffeur Modal */}
          {showShiftModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-800 space-y-5 relative max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiCalendar className="w-5 h-5 text-blue-600" />
                    Schedule Chauffeur Shift
                  </h3>
                  <button
                    onClick={() => setShowShiftModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreateShift} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Select Driver *
                    </label>
                    <select
                      value={shiftForm.driverId}
                      onChange={(e) => setShiftForm({ ...shiftForm, driverId: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                    >
                      {availableDrivers.map((d: any) => (
                        <option key={d._id || d.id} value={d._id || d.id}>
                          {d.name} ({d.locality || "Delhi-NCR"}) &middot; ₹{d.dailyRate || 1800}/day
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Shift Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={shiftForm.title}
                        onChange={(e) => setShiftForm({ ...shiftForm, title: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Cost Center *
                      </label>
                      <select
                        value={shiftForm.costCenter}
                        onChange={(e) =>
                          setShiftForm({ ...shiftForm, costCenter: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                      >
                        {org.costCenters?.map((cc) => (
                          <option key={cc} value={cc}>
                            {cc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={shiftForm.startDate}
                        onChange={(e) =>
                          setShiftForm({ ...shiftForm, startDate: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        End Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={shiftForm.endDate}
                        onChange={(e) => setShiftForm({ ...shiftForm, endDate: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Daily Start Time
                      </label>
                      <input
                        type="time"
                        value={shiftForm.dailyStartTime}
                        onChange={(e) =>
                          setShiftForm({ ...shiftForm, dailyStartTime: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Daily End Time
                      </label>
                      <input
                        type="time"
                        value={shiftForm.dailyEndTime}
                        onChange={(e) =>
                          setShiftForm({ ...shiftForm, dailyEndTime: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Primary Pickup / Dispatch Location *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acme HQ, Tower B, Cyber City, Gurugram"
                      value={shiftForm.pickupLocation}
                      onChange={(e) =>
                        setShiftForm({ ...shiftForm, pickupLocation: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setShowShiftModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={schedulingShift}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      {schedulingShift ? "Checking Conflicts & Rostering..." : "Confirm Shift"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Monthly GST Tax Invoice */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                Select Billing Month:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
              >
                <HiPrinter className="w-4 h-4" />
                Print / Export PDF
              </button>
            </div>
          </div>

          {loadingInvoice ? (
            <div className="flex flex-col items-center justify-center p-12 gap-3 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-xs text-gray-500">Aggregating monthly ride ledger & tax computations...</p>
            </div>
          ) : invoice ? (
            /* Official GST Tax Invoice Card */
            <div
              id="tax-invoice-printable"
              className="bg-white text-gray-900 rounded-3xl border border-gray-200 p-8 sm:p-12 shadow-md space-y-8"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-8 gap-6">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      M
                    </div>
                    <span className="text-2xl font-black text-gray-900">
                      <span className="text-blue-600">My</span>Mate
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {invoice.providerName || "MyMate Technologies India Private Limited"}
                    <br />
                    SAC Code: {invoice.sacCode || "9964"} (Passenger Transport Vehicle Rental Services)
                    <br />
                    GSTIN: {invoice.providerGstin || "27AABCM9999Z1Z8"} | PAN: {invoice.providerPan || "AABCM9999Z"}
                    <br />
                    {invoice.providerAddress || "DLF Cyber City, Sector 24, Gurugram, Haryana - 122002"}
                  </p>
                </div>

                <div className="sm:text-right space-y-1">
                  <span className="inline-block px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                    Tax Invoice
                  </span>
                  <p className="text-xs font-mono text-gray-600 mt-1">
                    Invoice #: <strong className="text-gray-900">{invoice.invoiceNumber}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Billing Period: {invoice.billingMonth}
                  </p>
                  <p className="text-xs text-gray-500">
                    Date: {new Date(invoice.generatedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Billed To (Corporate Customer)
                  </span>
                  <h4 className="text-base font-bold text-gray-900 mt-1">{invoice.organization}</h4>
                  <p className="text-xs text-gray-600 mt-1">{invoice.address}</p>
                </div>
                <div className="sm:text-right">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Tax Identification
                  </span>
                  <p className="text-xs font-mono font-bold text-gray-900 mt-1">
                    GSTIN: {invoice.gstin}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{invoice.billingEmail}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 uppercase tracking-wider text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">SAC Code</th>
                      <th className="py-3 px-4 text-center">Completed Rides</th>
                      <th className="py-3 px-4 text-right">Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="py-4 px-4">
                        <strong className="text-gray-900">
                          Corporate Chauffeur & Driver Hiring Services
                        </strong>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Consolidated rides by authorized employees during {invoice.billingMonth}
                        </p>
                      </td>
                      <td className="py-4 px-4 font-mono text-gray-600">9964</td>
                      <td className="py-4 px-4 text-center font-bold text-gray-900">
                        {invoice.totalTrips}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-gray-900 font-mono">
                        {formatINR(invoice.taxableValue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Computations Table */}
              <div className="flex justify-end pt-4">
                <div className="w-full sm:w-80 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Service Value:</span>
                    <span className="font-mono">{formatINR(invoice.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Central GST (CGST @ 9%):</span>
                    <span className="font-mono">{formatINR(invoice.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>State GST (SGST @ 9%):</span>
                    <span className="font-mono">{formatINR(invoice.sgst)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-1">
                    <span>Total Tax (18% GST):</span>
                    <span className="font-mono font-bold text-gray-800">
                      {formatINR(invoice.totalGst)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-blue-900 border-t-2 border-gray-900 pt-2">
                    <span>Total Amount (INR):</span>
                    <span className="font-mono">{formatINR(invoice.totalAmountINR)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Declaration */}
              <div className="border-t border-gray-200 pt-6 text-[11px] text-gray-400 space-y-1">
                <p>
                  <strong>Declaration:</strong> This is a computer-generated tax invoice issued
                  under Rule 46 of the Central Goods and Services Tax Rules, 2017. No physical
                  signature required.
                </p>
                <p>
                  Input Tax Credit (ITC) can be claimed against GSTR-2B filing using GSTIN:{" "}
                  {invoice.gstin}.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center text-sm text-gray-500">
              No invoice data found for the selected period.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

