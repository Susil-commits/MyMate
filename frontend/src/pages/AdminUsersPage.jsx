import { useState, useEffect } from "react";
import api from "../api/axios";
import Avatar from "../components/Avatar";
import { WindowedPagination } from "../components/WindowedPagination";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [toggling, setToggling] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/admin/users?page=${page}&limit=20`);
        setUsers(data.users);
        setPagination(data.pagination);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page]);

  const handleToggle = async (userId) => {
    setToggling(userId);
    try {
      const { data } = await api.put(`/admin/users/${userId}/toggle-active`);
      setUsers((prev) => prev.map((u) => (u._id === userId ? data.user : u)));
      toast.success(data.user.isActive ? "User activated" : "User deactivated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setToggling(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" /></div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">All Users</h1>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-3 font-semibold">User</th>
              <th className="text-left px-6 py-3 font-semibold">Phone</th>
              <th className="text-left px-6 py-3 font-semibold">Locality</th>
              <th className="text-left px-6 py-3 font-semibold">Joined</th>
              <th className="text-left px-6 py-3 font-semibold">Status</th>
              <th className="text-left px-6 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatar} name={u.name} size="sm" />
                    <div>
                      <p className="font-medium text-gray-900">{u.name || "—"}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{u.phone || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{u.locality || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    disabled={toggling === u._id}
                    onClick={() => handleToggle(u._id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 ${
                      u.isActive
                        ? "bg-red-50 text-red-600 hover:bg-red-100"
                        : "bg-green-50 text-green-600 hover:bg-green-100"
                    }`}
                  >
                    {toggling === u._id ? "..." : u.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <WindowedPagination page={pagination.page} pages={pagination.pages} onChange={setPage} accent="purple" />
    </div>
  );
}
