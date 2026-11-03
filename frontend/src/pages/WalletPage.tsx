import React, { useState, useEffect } from "react";
import { HiCreditCard, HiPlus, HiClock, HiArrowDown, HiArrowUp, HiCash, HiX, HiCheckCircle } from "react-icons/hi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import BackButton from "../components/BackButton";
import { loadRazorpay } from "../utils/loadRazorpay";
import { formatINR } from "../utils/constants";

interface WalletTransaction {
  _id: string;
  type: "credit" | "debit";
  description: string;
  amount: number;
  createdAt: string;
}

export default function WalletPage() {
  const { user } = useAuth();
  const isDriver = user?.role === "driver";

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // User Add Money state
  const [addAmount, setAddAmount] = useState("");
  const [adding, setAdding] = useState(false);

  // Driver Payout Withdrawal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"upi" | "bank_transfer">("upi");
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWallet = async () => {
    try {
      if (isDriver) {
        const { data } = await api.get("/drivers/wallet");
        setBalance(data.walletBalance || 0);
        setTransactions(data.transactions || []);
      } else {
        const { data } = await api.get("/wallet");
        setBalance(data.balance || 0);
        setTransactions(data.transactions || []);
      }
    } catch {
      toast.error("Failed to fetch wallet information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [isDriver]);

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(addAmount);
    if (!amount || amount < 10) {
      toast.error("Please enter a valid amount (Min: ₹10)");
      return;
    }

    setAdding(true);
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay unavailable");

      const { data } = await api.post("/wallet/order", { amount });

      const options = {
        key: data.keyId,
        amount: amount * 100,
        currency: "INR",
        name: "MyMate Wallet",
        description: "Wallet Recharge",
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            await api.post("/wallet/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amount,
            });
            toast.success("Wallet recharged successfully!");
            setAddAmount("");
            fetchWallet();
          } catch (err: any) {
            toast.error(err.response?.data?.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setAdding(false);
            toast.error("Payment cancelled");
          },
        },
        theme: { color: "#4f46e5" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        toast.error(resp.error?.description || "Payment failed");
        setAdding(false);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Could not initiate payment");
      setAdding(false);
    }
  };

  const handleWithdrawPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);

    if (!amount || amount < 100) {
      toast.error("Minimum payout withdrawal amount is ₹100.00");
      return;
    }
    if (amount > balance) {
      toast.error("Withdrawal amount cannot exceed available wallet balance");
      return;
    }

    if (payoutMethod === "upi") {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upiId.trim())) {
        toast.error("Please enter a valid UPI ID (e.g. driver@okhdfcbank or 9876543210@paytm)");
        return;
      }
    } else {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode.trim().toUpperCase())) {
        toast.error("Please enter a valid 11-character Indian Bank IFSC code (e.g. HDFC0001234)");
        return;
      }
      if (accountNumber.trim().length < 9 || accountNumber.trim().length > 18) {
        toast.error("Bank account number must be between 9 and 18 digits");
        return;
      }
      if (!accountHolder.trim()) {
        toast.error("Account holder name is required for bank transfer");
        return;
      }
    }

    setWithdrawing(true);
    try {
      const payload: any = {
        amount,
        method: payoutMethod,
      };
      if (payoutMethod === "upi") {
        payload.upiId = upiId.trim();
      } else {
        payload.accountNumber = accountNumber.trim();
        payload.ifscCode = ifscCode.trim().toUpperCase();
        payload.accountHolder = accountHolder.trim();
      }

      const { data } = await api.post("/drivers/payout/request", payload);
      toast.success(data.message || "Payout requested successfully!");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setUpiId("");
      setAccountNumber("");
      setIfscCode("");
      setAccountHolder("");
      fetchWallet();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to initiate payout withdrawal");
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 dark:text-gray-400 animate-pulse">Loading wallet...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-12">
      <BackButton
        to={isDriver ? "/driver/dashboard" : "/bookings"}
        label={isDriver ? "Back to Driver Dashboard" : "Back to Bookings"}
      />

      <div className="flex flex-col md:flex-row gap-6 mb-8 mt-2">
        {/* Balance Card */}
        <div className="flex-1 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <HiCreditCard className="w-24 h-24" />
          </div>
          <p className="text-indigo-100 font-medium mb-1 relative z-10">
            {isDriver ? "Driver Earnings Balance" : "Total Wallet Balance"}
          </p>
          <h1 className="text-5xl font-extrabold relative z-10">{formatINR(balance)}</h1>
          <p className="text-indigo-100 text-sm mt-4 relative z-10">
            {isDriver ? "Available for instant payout withdrawal" : "Available for bookings and rides"}
          </p>
          {isDriver && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              disabled={balance < 100}
              className="mt-6 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <HiCash className="w-5 h-5" /> Withdraw Earnings
            </button>
          )}
        </div>

        {/* Add Money Card (For Users) or Quick Summary Card (For Drivers) */}
        {!isDriver ? (
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Money to Wallet</h2>
            <form onSubmit={handleAddMoney} className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  min="10"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <button
                type="submit"
                disabled={adding}
                className="px-6 py-3 bg-gray-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <HiPlus /> {adding ? "Wait..." : "Add"}
              </button>
            </form>
            <div className="flex gap-2 mt-4">
              {[500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAddAmount(amt.toString())}
                  className="flex-1 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Automated Payout Engine</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Earnings from completed trips and chauffeur shifts are credited atomically at 85% net fare. Withdraw directly to your UPI ID or Bank Account.
            </p>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <HiCheckCircle className="text-emerald-500 w-4 h-4" /> Instant settlement via UPI (VPA) & IMPS
              </div>
              <div className="flex items-center gap-2">
                <HiCheckCircle className="text-emerald-500 w-4 h-4" /> Zero withdrawal transfer fees
              </div>
              <div className="flex items-center gap-2">
                <HiCheckCircle className="text-emerald-500 w-4 h-4" /> Minimum payout threshold: ₹100.00
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-6">
          <HiClock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaction History</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
            No transactions recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((txn) => (
              <div
                key={txn._id}
                className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      txn.type === "credit"
                        ? "bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                    }`}
                  >
                    {txn.type === "credit" ? <HiArrowDown /> : <HiArrowUp />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{txn.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(txn.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div
                  className={`font-bold ${
                    txn.type === "credit"
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {txn.type === "credit" ? "+" : "-"}
                  {formatINR(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Driver Payout Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-gray-100 dark:border-gray-800 shadow-2xl relative">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <HiX className="w-6 h-6" />
            </button>

            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-1">
              Withdraw Driver Earnings
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Available Balance: <span className="font-bold text-gray-800 dark:text-gray-200">{formatINR(balance)}</span>
            </p>

            <form onSubmit={handleWithdrawPayout} className="space-y-4">
              {/* Method Tabs */}
              <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPayoutMethod("upi")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    payoutMethod === "upi"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  UPI VPA Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setPayoutMethod("bank_transfer")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    payoutMethod === "bank_transfer"
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  Bank Account (IMPS/NEFT)
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Withdrawal Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="100"
                    max={balance}
                    step="1"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount (Min ₹100)"
                    className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                    required
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[500, 1000, 2000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={preset > balance}
                      onClick={() => setWithdrawAmount(preset.toString())}
                      className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 disabled:opacity-40"
                    >
                      ₹{preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(Math.floor(balance).toString())}
                    className="px-2.5 py-1 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold"
                  >
                    Max All
                  </button>
                </div>
              </div>

              {/* Method-specific inputs */}
              {payoutMethod === "upi" ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    UPI Virtual Payment Address (VPA)
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. driver@okhdfcbank or 9876543210@paytm"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      placeholder="Name as per Bank Passbook"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="9 to 18 digits account number"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Bank IFSC Code
                    </label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="e.g. HDFC0001234"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs uppercase"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={withdrawing || balance < 100}
                className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {withdrawing ? "Processing Instant Payout..." : `Disburse ₹${withdrawAmount || "0"} to ${payoutMethod === "upi" ? "UPI" : "Bank"}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
