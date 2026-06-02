"use client";

/**
 * Admin Cleaners Page
 * Lists location_cleaner field workers with their total video recording hours.
 * Cleaners are mobile-only (no dashboard access); this is the admin/superadmin
 * view of how much each has recorded. Data joins:
 *   - /api/admin/cleaners        → the cleaner roster (tenant-scoped)
 *   - /api/admin/recording-hours → hours keyed by Firebase Auth uid
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Search } from "lucide-react";

interface Cleaner {
  uid: string;
  email: string;
  displayName: string;
  organizationId?: string;
}

interface RecordingRow {
  userId: string;
  totalHours: number;
  videoCount: number;
  lastRecordedAt: string | null;
}

type RangeKey = "all" | "30d" | "7d";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "all", label: "All time", days: null },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "7d", label: "Last 7 days", days: 7 },
];

export default function AdminCleanersPage() {
  const { user, claims } = useAuth();
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [hoursByUid, setHoursByUid] = useState<Record<string, RecordingRow>>(
    {},
  );
  const [range, setRange] = useState<RangeKey>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Roster rarely changes; load it once.
  const loadCleaners = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/cleaners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCleaners(data.cleaners || []);
      }
    } catch (error) {
      console.error("Failed to load cleaners:", error);
    }
  }, [user]);

  // Hours re-fetch whenever the date range changes.
  const loadHours = useCallback(
    async (selected: RangeKey) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const days = RANGES.find((r) => r.key === selected)?.days ?? null;
        const params = new URLSearchParams();
        if (days != null) {
          const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
          params.set("from", from.toISOString());
        }
        const query = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/admin/recording-hours${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, RecordingRow> = {};
          for (const row of data.cleaners || []) {
            map[row.userId] = row;
          }
          setHoursByUid(map);
        }
      } catch (error) {
        console.error("Failed to load recording hours:", error);
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user || !claims) return;
    setLoading(true);
    Promise.all([loadCleaners(), loadHours(range)]).finally(() =>
      setLoading(false),
    );
    // range is intentionally included: changing it re-fetches hours.
  }, [user, claims, range, loadCleaners, loadHours]);

  const q = search.trim().toLowerCase();
  const filtered = cleaners.filter(
    (c) =>
      !q ||
      c.displayName?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q),
  );

  // Sort by recorded hours desc so the most active cleaners surface first.
  filtered.sort(
    (a, b) =>
      (hoursByUid[b.uid]?.totalHours ?? 0) -
      (hoursByUid[a.uid]?.totalHours ?? 0),
  );

  // Sum only the cleaners shown — hoursByUid also holds teleoperator uids.
  const totalHours = filtered.reduce(
    (sum, c) => sum + (hoursByUid[c.uid]?.totalHours ?? 0),
    0,
  );

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-7 h-7 text-orange-500" />
        <div>
          <h1 className="text-3xl font-bold">Cleaners</h1>
          <p className="text-sm text-gray-500">
            Video recording hours per field cleaner.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                range === r.key
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cleaners..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            {search ? "No cleaners match your search." : "No cleaners found."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-6 py-3 font-medium">Cleaner</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium text-right">
                    Recording Hours
                  </th>
                  <th className="px-6 py-3 font-medium text-right">Segments</th>
                  <th className="px-6 py-3 font-medium text-right">
                    Last Recording
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const row = hoursByUid[c.uid];
                  const hours = row?.totalHours ?? 0;
                  return (
                    <tr
                      key={c.uid}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {c.displayName || c.email?.split("@")[0] || "Unknown"}
                      </td>
                      <td className="px-6 py-3 text-gray-600">{c.email}</td>
                      <td className="px-6 py-3 text-right font-bold text-blue-600">
                        {hours.toFixed(1)}h
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {row?.videoCount ?? 0}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-500">
                        {row?.lastRecordedAt
                          ? new Date(row.lastRecordedAt).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 font-semibold">
                  <td className="px-6 py-3" colSpan={2}>
                    {filtered.length} cleaner
                    {filtered.length === 1 ? "" : "s"}
                  </td>
                  <td className="px-6 py-3 text-right text-blue-600">
                    {totalHours.toFixed(1)}h
                  </td>
                  <td className="px-6 py-3" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
