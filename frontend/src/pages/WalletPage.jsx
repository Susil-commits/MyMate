import { useState, useEffect } from "react";
import { HiCreditCard, HiPlus, HiClock, HiArrowDown, HiArrowUp } from "react-icons/hi";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import BackButton from "../components/BackButton";
import { loadRazorpay } from "../utils/loadRazorpay";
import { formatINR } from "../utils/constants";

export default function WalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addAmount, setAddAmount] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchWallet = async () => {
    try {
      const { data } = await api.get("/wallet");
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch {
      toast.error("Failed to fetch wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchWallet();
  }, []);

  const handleAddMoney = async (e) => {
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
        handler: async (response) => {
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
          } catch (err) {
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
      rzp.on("payment.failed", (resp) => {
        toast.error(resp.error?.description || "Payment failed");
        setAdding(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not initiate payment");
      setAdding(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">Loading wallet...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <BackButton to={user?.role === "driver" ? "/driver/dashboard" : "/dashboard"} label="Back to Dashboard" />
      
      <div className="flex flex-col md:flex-row gap-6 mb-8 mt-2">
        {/* Balance Card */}
        <div className="flex-1 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <HiCreditCard className="w-24 h-24" />
          </div>
          <p className="text-indigo-100 font-medium mb-1 relative z-10">Total Balance</p>
          <h1 className="text-5xl font-extrabold relative z-10">{formatINR(balance)}</h1>
          <p className="text-indigo-100 text-sm mt-4 relative z-10">Available for bookings and payments</p>
        </div>

        {/* Add Money Card */}
        <div className="flex-1 bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col justify-center">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Money to Wallet</h2>
          <form onSubmit={handleAddMoney} className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <input
                type="number"
                min="10"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Amount"
                className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
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
                className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                +₹{amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-6">
          <HiClock className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-2xl">
            No transactions yet. Add money to get started!
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((txn) => (
              <div key={txn._id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {txn.type === 'credit' ? <HiArrowDown /> : <HiArrowUp />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{txn.description}</p>
                    <p className="text-xs text-gray-500">{new Date(txn.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className={`font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                  {txn.type === 'credit' ? '+' : '-'}{formatINR(txn.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
