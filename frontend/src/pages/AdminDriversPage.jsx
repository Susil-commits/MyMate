import { useState, useEffect } from "react";
import api from "../api/axios";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 20 });
        if (kycFilter) params.set("kycStatus", kycFilter);
        const { data } = await api.get(`/admin/drivers?${params}`);
        setDrivers(data.drivers);
        setPagination(data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [kycFilter, page]);

  const handleFilterChange = (val) => {
    setKycFilter(val);
    setPage(1);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900">All Drivers</h1>
        <select value={kycFilter} onChange={(e) => handleFilterChange(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Email</th>
              <th className="text-left px-6 py-3 font-semibold">Locality</th>
              <th className="text-left px-6 py-3 font-semibold">KYC</th>
              <th className="text-left px-6 py-3 font-semibold">Active</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d._id} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="px-6 py-4 font-medium">{d.name || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{d.email}</td>
                <td className="px-6 py-4 text-gray-500">{d.locality || "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                    d.kycStatus === "approved" ? "bg-green-100 text-green-700" :
                    d.kycStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{d.kycStatus}</span>
                </td>
                <td className="px-6 py-4">{d.isActive ? <span className="text-green-600 font-semibold">Yes</span> : <span className="text-gray-400">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination.pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button disabled={pagination.page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Prev</button>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`px-4 py-2 rounded-xl text-sm font-semibold ${p === pagination.page ? "bg-purple-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{p}</button>
          ))}
          <button disabled={pagination.page >= pagination.pages} onClick={() => setPage(page + 1)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
        </div>
      )}
    </div>
  );
}