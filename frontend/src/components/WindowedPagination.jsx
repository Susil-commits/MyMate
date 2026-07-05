// eslint-disable-next-line react-refresh/only-export-components
export function getPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  const range = [1];
  if (left > 2) range.push("…");
  for (let i = left; i <= right; i++) range.push(i);
  if (right < total - 1) range.push("…");
  range.push(total);
  return range;
}

export function WindowedPagination({ page, pages, onChange, accent = "blue" }) {
  if (pages <= 1) return null;
  const list = getPageList(page, pages);
  const btn =
    "px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
  const accentMap = {
    blue: "bg-blue-600 text-white shadow-sm",
    purple: "bg-purple-600 text-white shadow-sm",
    green: "bg-green-600 text-white shadow-sm",
  };
  const accentBg = accentMap[accent] || accentMap.blue;
  const idleBg = "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50";

  return (
    <div className="mt-6 flex justify-center items-center gap-2">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className={`${btn} ${idleBg}`}>
        Prev
      </button>
      {list.map((p, idx) =>
        p === "…" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${btn} ${p === page ? accentBg : idleBg}`}
          >
            {p}
          </button>
        )
      )}
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className={`${btn} ${idleBg}`}>
        Next
      </button>
    </div>
  );
}
