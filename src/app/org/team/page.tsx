"use client";

/**
 * Organization Team Page
 * Shows all teleoperators in the organization (read-only for org_manager)
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function OrgTeamPage() {
  const router = useRouter();
  const { user, claims, getIdToken } = useAuth();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [teleoperators, setTeleoperators] = useState<any[]>([]);
  const [recordingHours, setRecordingHours] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user || !claims || !claims.organizationId) return;

      try {
        const token = await getIdToken();
        if (!token) return;

        // Get user info
        const userResponse = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setCurrentUser(userData);
        }

        // Get dashboard data which includes teleoperators
        const dashboardResponse = await fetch(
          `/api/v1/organizations/${claims.organizationId}/dashboard`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (dashboardResponse.ok) {
          const dashboardData = await dashboardResponse.json();
          setTeleoperators(dashboardData.data?.teleoperators || []);
        }

        // Per-cleaner recording hours, keyed by Firebase uid for joining onto
        // the team cards below.
        const hoursResponse = await fetch(
          `/api/v1/organizations/${claims.organizationId}/recording-hours`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (hoursResponse.ok) {
          const hoursData = await hoursResponse.json();
          const map: Record<string, number> = {};
          for (const c of hoursData.cleaners || []) {
            map[c.userId] = c.totalHours;
          }
          setRecordingHours(map);
        }
      } catch (error) {
        console.error("Failed to load team data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user && claims) {
      loadData();
    }
  }, [user, claims, getIdToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">👥 Team Members</h1>

      {teleoperators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-600">
              No team members in this organization yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teleoperators.map((teleop: any) => (
            <Card key={teleop.id || teleop.teleoperatorId}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>
                    {teleop.displayName ||
                      teleop.email?.split("@")[0] ||
                      "Unknown"}
                  </span>
                  <Badge
                    variant={
                      teleop.status === "available"
                        ? "default"
                        : teleop.status === "busy"
                          ? "secondary"
                          : "secondary"
                    }
                  >
                    {teleop.status || "offline"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium">{teleop.email}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                    <div>
                      <p className="text-sm text-gray-600">Tasks Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {teleop.completions?.length || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Avg Duration</p>
                      <p className="text-2xl font-bold">
                        {teleop.avgDuration
                          ? `${Math.round(teleop.avgDuration)} min`
                          : "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <p className="text-sm text-gray-600">Recording Hours</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(
                        recordingHours[
                          teleop.uid ??
                            teleop.userId ??
                            teleop.id ??
                            teleop.teleoperatorId
                        ] ?? 0
                      ).toFixed(1)}
                      h
                    </p>
                  </div>

                  {teleop.successRate !== undefined && (
                    <div className="pt-3 border-t">
                      <p className="text-sm text-gray-600">Success Rate</p>
                      <p className="text-xl font-bold text-green-600">
                        {Math.round(teleop.successRate)}%
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
