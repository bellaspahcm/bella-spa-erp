"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Building2, Users, FileText, FolderKanban, Loader2, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

type ResultType = "project" | "product" | "customer" | "lead";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle: string;
  href: string;
}

const TYPE_CONFIG: Record<ResultType, { icon: React.ElementType; color: string; label: string }> = {
  project: { icon: FolderKanban, color: "text-blue-400 bg-blue-500/10", label: "Dự Án" },
  product: { icon: Building2, color: "text-amber-400 bg-amber-500/10", label: "Căn Hộ" },
  customer: { icon: Users, color: "text-emerald-400 bg-emerald-500/10", label: "Khách Hàng" },
  lead: { icon: FileText, color: "text-purple-400 bg-purple-500/10", label: "Lead" },
};

export default function GlobalSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const supabase = createClient();
      const like = `%${q}%`;

      const [projRes, prodRes] = await Promise.allSettled([
        supabase
          .from("real_estate_projects")
          .select("id, name, status")
          .ilike("name", like)
          .limit(5),
        supabase
          .from("real_estate_products")
          .select("id, product_code, product_type, status, project_id")
          .or(`product_code.ilike.${like},product_type.ilike.${like}`)
          .limit(5),
      ]);

      const all: SearchResult[] = [];

      if (projRes.status === "fulfilled" && projRes.value.data) {
        projRes.value.data.forEach(p => all.push({
          id: p.id,
          type: "project",
          title: p.name,
          subtitle: `Trạng thái: ${p.status}`,
          href: `/dashboard/real-estate/projects`,
        }));
      }

      if (prodRes.status === "fulfilled" && prodRes.value.data) {
        prodRes.value.data.forEach(p => all.push({
          id: p.id,
          type: "product",
          title: `${p.product_code} — ${p.product_type || "Căn hộ"}`,
          subtitle: `Trạng thái: ${p.status}`,
          href: `/dashboard/real-estate/apartments`,
        }));
      }

      setResults(all);
    } catch (e) {
      console.error("[GlobalSearch] Error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (q: string) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 350);
  };

  const SUGGESTIONS = [
    "The Grand Tower", "Riverside", "CH001", "Đặt cọc", "HĐMB", "Block A"
  ];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Tìm Kiếm Toàn Cục</h1>
        <p className="text-white/40">Tìm dự án, căn hộ, khách hàng, hợp đồng ngay lập tức</p>
      </div>

      {/* Search Box */}
      <div className="relative">
        <div className={`flex items-center gap-3 bg-white/8 border ${query ? "border-amber-500/50 bg-amber-500/5" : "border-white/15"} rounded-2xl px-5 py-4 transition-all`}>
          {loading ? (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-white/40 shrink-0" />
          )}
          <input
            autoFocus
            value={query}
            onChange={e => handleInput(e.target.value)}
            placeholder="Nhập tên dự án, mã căn hộ, tên khách hàng..."
            className="flex-1 bg-transparent text-white text-lg placeholder:text-white/20 focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }} className="text-white/30 hover:text-white transition-colors">
              ×
            </button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {!query && (
        <div className="space-y-3">
          <p className="text-white/30 text-xs uppercase tracking-widest font-semibold">Gợi ý tìm kiếm phổ biến</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleInput(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white/50 hover:text-white text-sm transition-all"
              >
                <Search className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {searched && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {results.length === 0 && !loading && (
              <div className="text-center py-16 text-white/30">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Không tìm thấy kết quả cho &ldquo;<span className="text-white/50">{query}</span>&rdquo;</p>
              </div>
            )}

            {results.length > 0 && (
              <>
                <p className="text-white/30 text-xs uppercase tracking-widest font-semibold mb-3">
                  {results.length} kết quả
                </p>
                {results.map((res, i) => {
                  const cfg = TYPE_CONFIG[res.type];
                  const Icon = cfg.icon;
                  return (
                    <motion.button
                      key={res.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => router.push(res.href)}
                      className="w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-left group"
                    >
                      <div className={`p-2.5 rounded-xl ${cfg.color.split(" ")[1]} shrink-0`}>
                        <Icon className={`w-5 h-5 ${cfg.color.split(" ")[0]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{res.title}</p>
                        <p className="text-white/40 text-xs mt-0.5">{res.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color.split(" ")[1]} ${cfg.color.split(" ")[0]}`}>
                          {cfg.label}
                        </span>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
                      </div>
                    </motion.button>
                  );
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category shortcuts */}
      {!searched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          {(Object.entries(TYPE_CONFIG) as [ResultType, typeof TYPE_CONFIG[ResultType]][]).map(([type, cfg]) => {
            const Icon = cfg.icon;
            const routes: Record<ResultType, string> = {
              project: "/dashboard/real-estate/projects",
              product: "/dashboard/real-estate/apartments",
              customer: "/dashboard/real-estate/customers",
              lead: "/dashboard/real-estate/customers",
            };
            return (
              <button
                key={type}
                onClick={() => router.push(routes[type])}
                className={`flex flex-col items-center gap-2 p-5 ${cfg.color.split(" ")[1]} border border-white/10 rounded-2xl hover:border-white/20 transition-all`}
              >
                <Icon className={`w-7 h-7 ${cfg.color.split(" ")[0]}`} />
                <span className="text-white/70 text-sm font-semibold">{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
