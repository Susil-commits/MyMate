import { useState, useEffect } from "react";
import api from "../api/axios";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

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

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200 border-t-purple-600" /></div>;

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-gray-900 mb-6">All Users</h1>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-6 py-3 font-semibold">Name</th>
              <th className="text-left px-6 py-3 font-semibold">Email</th>
              <th className="text-left px-6 py-3 font-semibold">Phone</th>
              <th className="text-left px-6 py-3 font-semibold">Locality</th>
              <th className="text-left px-6 py-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b last:border-0 hover:bg-gray-50/50">
                <td className="px-6 py-4 font-medium">{u.name || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{u.email}</td>
                <td className="px-6 py-4 text-gray-500">{u.phone || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{u.locality || "—"}</td>
                <td className="px-6 py-4 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
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