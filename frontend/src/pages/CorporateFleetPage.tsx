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
  totalTrips: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  totalGst: number;
  totalAmountINR: number;
  currency: string;
  generatedAt: string;
}

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function CorporateFleetPage(): React.ReactElement {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [org, setOrg] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "roster" | "invoices">("overview");

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
      } else {
        setOrg(null);
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
              {org.members?.map((memberId, idx) => {
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
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Monthly GST Tax Invoice */}
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
                    MyMate Technologies India Private Limited
                    <br />
                    SAC Code: 9964 (Passenger Transport Vehicle Rental Services)
                    <br />
                    GSTIN: 27AABCM9999Z1Z8 | PAN: AABCM9999Z
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
