import { useState, useEffect } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import { HiX, HiCheck, HiEye } from "react-icons/hi";
import Avatar from "../components/Avatar";
import { WindowedPagination } from "../components/WindowedPagination";
import ConfirmDialog from "../components/ConfirmDialog";

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [kycFilter, setKycFilter] = useState("");
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page, limit: 20 });
        if (kycFilter) params.set("kycStatus", kycFilter);
        const { data } = await api.get(`/admin/drivers?${params}`);
        if (!active) return;
        setDrivers(data.drivers);
        setPagination(data.pagination);
      } catch (err) {
        if (active) console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [kycFilter, page]);

  const handleFilterChange = (val) => {
    setKycFilter(val);
    setPage(1);
  };

  const handleToggleActive = async (driverId) => {
    setToggling(driverId);
    try {
      const { data } = await api.put(`/admin/drivers/${driverId}/toggle-active`);
      setDrivers((prev) => prev.map((d) => (d._id === driverId ? data.driver : d)));
      toast.success(`Driver ${data.driver.isActive ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update driver status");
    } finally {
      setToggling(null);
    }
  };

  const openDetail = async (driverId) => {
    setSelected({ _id: driverId });
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/admin/drivers/${driverId}`);
      setSelected(data.driver);
    } catch {
      toast.error("Failed to load driver");
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyTarget || !verifyStatus) return;
    setVerifying(true);
    try {
      const { data } = await api.put(`/admin/drivers/${verifyTarget}/verify`, { status: verifyStatus });
      setDrivers((prev) => prev.map((d) => (d._id === verifyTarget ? data.driver : d)));
      if (selected?._id === verifyTarget) setSelected(data.driver);
      toast.success(`Driver ${verifyStatus}`);
      setVerifyTarget(null);
      setVerifyStatus(null);
    } catch {
      toast.error("Failed to verify driver");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">All Drivers</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} drivers</p>
        </div>
        <select value={kycFilter} onChange={(e) => handleFilterChange(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all duration-200">
          <option value="">All KYC</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 font-semibold text-gray-600">Driver</th>
              <th className="text-left px-6 py-3 font-semibold text-gray-600">Locality</th>
              <th className="text-left px-6 py-3 font-semibold text-gray-600">KYC</th>
              <th className="text-left px-6 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-6 py-3 font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d._id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={d.avatar} name={d.name} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{d.name || "—"}</p>
                      <p className="text-xs text-gray-400">{d.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{d.locality || "—"}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                    d.kycStatus === "approved" ? "bg-green-100 text-green-700" :
                    d.kycStatus === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
                  }`}>{d.kycStatus}</span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleActive(d._id)}
                    disabled={toggling === d._id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
                      d.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {d.isActive ? <HiCheck className="w-3.5 h-3.5" /> : <HiX className="w-3.5 h-3.5" />}
                    {d.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => openDetail(d._id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-semibold hover:bg-purple-100 transition-all duration-200">
                    <HiEye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <WindowedPagination page={pagination.page} pages={pagination.pages} onChange={setPage} accent="purple" />

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setSelected(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            {detailLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <Avatar src={selected.avatar} name={selected.name} size="lg" />
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                      <p className="text-sm text-gray-500">{selected.email}</p>
                      <p className="text-sm text-gray-500">{selected.phone || "No phone"}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:bg-gray-50 rounded-xl transition-all duration-200">
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Locality" value={selected.locality} />
                  <Info label="Nationality" value={selected.nationality} />
                  <Info label="Experience" value={`${selected.experienceYears} years`} />
                  <Info label="License No." value={selected.licenseNumber} />
                  <Info label="Hourly Rate" value={`₹${selected.hourlyRate}`} />
                  <Info label="Daily Rate" value={`₹${selected.dailyRate}`} />
                  <Info label="Rating" value={`${selected.averageRating} (${selected.totalReviews})`} />
                  <Info label="KYC Status" value={selected.kycStatus} />
                </div>

                {selected.vehicleTypes?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Vehicles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.vehicleTypes.map((v) => (
                        <span key={v} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-lg">{v}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.languages?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Languages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.languages.map((l) => (
                        <span key={l} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded-lg">{l}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.bio && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Bio</p>
                    <p className="text-sm text-gray-700">{selected.bio}</p>
                  </div>
                )}

                {selected.licenseImage?.url && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">License Document</p>
                    <button
                      onClick={() => setPreviewImage(selected.licenseImage.url)}
                      className="block group w-full text-left focus:outline-none"
                    >
                      <img src={selected.licenseImage.url} loading="lazy" alt="License" className="w-full rounded-xl border border-gray-200 object-cover max-h-64 group-hover:opacity-90 transition-opacity" />
                    </button>
                  </div>
                )}

                {selected.kycStatus === "pending" && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => { setVerifyTarget(selected._id); setVerifyStatus("approved"); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-all duration-200"
                    >
                      <HiCheck className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => { setVerifyTarget(selected._id); setVerifyStatus("rejected"); }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-all duration-200"
                    >
                      <HiX className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}

                <ConfirmDialog
                  open={!!verifyTarget}
                  title="Verify Driver"
                  message="Confirm this KYC decision? The driver will be notified."
                  confirmLabel={verifyStatus === "approved" ? "Approve" : "Reject"}
                  variant={verifyStatus === "approved" ? "success" : "danger"}
                  loading={verifying}
                  onConfirm={handleVerify}
                  onCancel={() => { setVerifyTarget(null); setVerifyStatus(null); }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all">
            <HiX className="w-6 h-6" />
          </button>
          <img src={previewImage} loading="lazy" alt="Preview" className="max-w-full max-h-[90vh] rounded-xl object-contain animate-scale-in" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="p-3 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900 capitalize">{value || "—"}</p>
    </div>
  );
}
