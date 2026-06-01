"use client";

/**
 * Admin Teleoperators Management Page
 * CRUD operations for teleoperators
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Teleoperator, TeleoperatorStatus } from "@/lib/types";
import type { Organization } from "@/lib/repositories/organizations";
import toast from "react-hot-toast";
import { Plus, User, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminTeleoperatorsPage() {
  const { user, claims } = useAuth();
  const [teleoperators, setTeleoperators] = useState<Teleoperator[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [recordingHours, setRecordingHours] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    photoUrl: "",
    partnerOrgId: "",
    organizationId: "",
    organizationName: "",
    phone: "",
    currentStatus: "offline" as TeleoperatorStatus,
    certifications: [] as string[],
    robotTypesQualified: [] as string[],
  });

  // Load teleoperators
  const loadTeleoperators = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/v1/teleoperators", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load teleoperators");
      }

      const data = await response.json();
      setTeleoperators(data.teleoperators || []);
    } catch (error) {
      console.error("Failed to load teleoperators:", error);
      toast.error("Failed to load teleoperators");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load organizations
  const loadOrganizations = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingOrganizations(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/v1/organizations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error("Failed to load organizations:", error);
    } finally {
      setLoadingOrganizations(false);
    }
  }, [user]);

  // Load per-cleaner recording hours, keyed by Firebase uid.
  const loadRecordingHours = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/recording-hours", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const map: Record<string, number> = {};
        for (const c of data.cleaners || []) {
          map[c.userId] = c.totalHours;
        }
        setRecordingHours(map);
      }
    } catch (error) {
      console.error("Failed to load recording hours:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !claims) return;

    loadTeleoperators();
    loadOrganizations();
    loadRecordingHours();
  }, [user, claims, loadTeleoperators, loadOrganizations, loadRecordingHours]);

  async function handleCreate() {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (
      !formData.email ||
      !formData.displayName ||
      !formData.partnerOrgId ||
      !formData.organizationId
    ) {
      toast.error(
        "Please fill in all required fields (email, display name, partner, and organization)",
      );
      return;
    }

    try {
      setCreating(true);
      const token = await user.getIdToken();
      const response = await fetch("/api/v1/teleoperators", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: formData.email,
          displayName: formData.displayName,
          photoUrl: formData.photoUrl || undefined,
          partnerOrgId: formData.partnerOrgId,
          organizationId: formData.organizationId,
          organizationName: formData.organizationName,
          phone: formData.phone || undefined,
          currentStatus: formData.currentStatus,
          certifications: formData.certifications,
          robotTypesQualified: formData.robotTypesQualified,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create teleoperator");
      }

      const data = await response.json();
      toast.success(`Teleoperator created: ${data.teleoperatorId}`);
      setShowCreateForm(false);
      setFormData({
        email: "",
        displayName: "",
        photoUrl: "",
        partnerOrgId: "",
        organizationId: "",
        organizationName: "",
        phone: "",
        currentStatus: "offline",
        certifications: [],
        robotTypesQualified: [],
      });
      await loadTeleoperators();
    } catch (error: any) {
      console.error("Failed to create teleoperator:", error);
      toast.error(error.message || "Failed to create teleoperator");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(
    teleoperatorId: string,
    newStatus: TeleoperatorStatus,
  ) {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/v1/teleoperators/${teleoperatorId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("Status updated");
      await loadTeleoperators();
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error("Failed to update status");
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading teleoperators...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teleoperators</h1>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Teleoperator
        </Button>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Teleoperator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="teleoperator@example.com"
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="partnerOrgId">Partner Organization ID *</Label>
              <Input
                id="partnerOrgId"
                value={formData.partnerOrgId}
                onChange={(e) =>
                  setFormData({ ...formData, partnerOrgId: e.target.value })
                }
                placeholder="partner-org-123"
              />
            </div>
            <div>
              <Label htmlFor="organizationId">Organization *</Label>
              {loadingOrganizations ? (
                <p className="text-sm text-gray-500">
                  Loading organizations...
                </p>
              ) : (
                <select
                  id="organizationId"
                  className="w-full p-2 border rounded"
                  value={formData.organizationId}
                  onChange={(e) => {
                    const selectedOrg = organizations.find(
                      (org) => org.id === e.target.value,
                    );
                    setFormData({
                      ...formData,
                      organizationId: e.target.value,
                      organizationName: selectedOrg?.name || "",
                    });
                  }}
                  required
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teleoperators.map((teleoperator) => (
          <Card key={teleoperator.teleoperatorId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {teleoperator.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                {teleoperator.email}
              </div>
              {teleoperator.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  {teleoperator.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                Partner: {teleoperator.partnerOrgId}
              </div>
              <div className="mt-4">
                <Label>Status</Label>
                <select
                  className="w-full mt-1 p-2 border rounded"
                  value={teleoperator.currentStatus}
                  onChange={(e) =>
                    handleStatusChange(
                      teleoperator.teleoperatorId,
                      e.target.value as TeleoperatorStatus,
                    )
                  }
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                  <option value="on-break">On Break</option>
                </select>
              </div>
              <div className="mt-2 text-sm text-gray-500">
                Tasks Completed: {teleoperator.tasksCompleted} | Hours:{" "}
                {teleoperator.hoursWorked}
              </div>
              <div className="mt-1 text-sm font-medium text-blue-600">
                Recording:{" "}
                {(
                  recordingHours[
                    (teleoperator as any).userId ??
                      (teleoperator as any).uid ??
                      teleoperator.teleoperatorId
                  ] ?? 0
                ).toFixed(1)}
                h
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teleoperators.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <p>
              No teleoperators found. Create your first teleoperator to get
              started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
