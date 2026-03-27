"use client";

/**
 * Organization Detail Page
 * Data-delivery focused dashboard for OEM partners
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getAuth } from 'firebase/auth';
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Package,
  Film,
  Clock,
  HardDrive,
  MapPin,
  Key,
  Settings,
  Building2,
  BedDouble,
  Bath,
  UtensilsCrossed,
  Sofa,
  ClipboardList,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
  Edit2,
  X,
} from "lucide-react";
import { VideoGallery } from '@/components/ui/VideoGallery';
import { VideoThumbnail } from '@/components/ui/VideoThumbnail';
import { VideoPreviewModal } from '@/components/ui/VideoPreviewModal';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Organization } from "@/lib/repositories/organizations";

// Helper to format seconds to MM:SS or HH:MM:SS
function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type TabType = "overview" | "deliveries" | "locations" | "api" | "settings";

interface Delivery {
  id: string;
  videoCount: number;
  sizeGB: number;
  hours?: number;
  description: string;
  date: string;
  partnerId?: string | null;
  partnerName?: string | null;
}

interface AssignedLocation {
  id: string;
  name: string;
  address: string;
  roomCounts: {
    bedroom: number;
    bathroom: number;
    kitchen: number;
    livingArea: number;
    other: number;
  };
  taskCount: number;
  totalSqFt?: number;
}

export default function OrganizationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const organizationId = decodeURIComponent(params.id as string);
  const { user } = useAuth();

  // Initialize activeTab from URL params or default to "overview"
  const getInitialTab = (): TabType => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "deliveries" || tab === "locations" || tab === "api" || tab === "settings") {
      return tab;
    }
    return "overview";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [assignedLocations, setAssignedLocations] = useState<AssignedLocation[]>([]);
  const [availableLocations, setAvailableLocations] = useState<AssignedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditOrg, setShowEditOrg] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    url: string;
    fileName?: string;
  } | null>(null);
  const [sampleVideos, setSampleVideos] = useState<Array<{
    id: string;
    url: string;
    fileName?: string;
    durationSeconds?: number;
    locationName?: string;
    roomType?: string;
  }>>([]);
  
  // Demo mode state
  const [demoMode, setDemoMode] = useState(false);
  const [editableStats, setEditableStats] = useState({
    totalVideos: 0,
    totalHours: 0,
    totalStorageGB: 0,
    deliveryCount: 0,
    totalLocations: 0,
    bedrooms: 0,
    bathrooms: 0,
    kitchens: 0,
    livingAreas: 0,
    totalTasks: 0,
  });
  const [savingDemoStats, setSavingDemoStats] = useState(false);
  
  // Location Access editing state
  const [editingLocationStats, setEditingLocationStats] = useState(false);
  const [locationStatsValues, setLocationStatsValues] = useState({
    locations: 0,
    bedrooms: 0,
    bathrooms: 0,
    kitchens: 0,
    livingAreas: 0,
    totalTasks: 0,
  });
  const [savingLocationStats, setSavingLocationStats] = useState(false);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Sync activeTab from URL params (e.g., on browser back/forward)
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "overview" || tab === "deliveries" || tab === "locations" || tab === "api" || tab === "settings") {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab("overview");
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    if (!user || !organizationId) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      // Load organization
      const orgResponse = await fetch(`/api/v1/organizations/${organizationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!orgResponse.ok) {
        if (orgResponse.status === 404) {
          toast.error("Organization not found");
          router.push("/admin/organizations");
          return;
        }
        throw new Error("Failed to load organization");
      }

      const orgData = await orgResponse.json();
      setOrganization(orgData.organization);

      // Load deliveries for this partner
      const deliveriesRes = await fetch("/api/admin/data-intelligence", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (deliveriesRes.ok) {
        const data = await deliveriesRes.json();
        const partnerDeliveries = data.deliveries.filter(
          (d: Delivery) => d.partnerId === organizationId
        );
        setDeliveries(partnerDeliveries);
      }

      // Load assigned locations
      const locationsRes = await fetch(`/api/v1/organizations/${organizationId}/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (locationsRes.ok) {
        const locData = await locationsRes.json();
        setAssignedLocations(locData.locations || []);
      } else {
        // Fallback: try to get locations from dashboard endpoint
        const dashboardRes = await fetch(`/api/v1/organizations/${organizationId}/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          const locations = (dashboardData.data?.locations || []).map((loc: any) => ({
            id: loc.id,
            name: loc.name,
            address: loc.address || "",
            roomCounts: {
              bedroom: 0,
              bathroom: 0,
              kitchen: 0,
              livingArea: 0,
              other: 0,
            },
            taskCount: loc.taskCount || 0,
          }));
          setAssignedLocations(locations);
        }
      }

      // Load available locations (unassigned)
      const availableRes = await fetch("/api/v1/locations?unassigned=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (availableRes.ok) {
        const availData = await availableRes.json();
        setAvailableLocations(availData.locations || []);
      }

      // Load sample videos for this partner
      try {
        const videosRes = await fetch(`/api/v1/organizations/${organizationId}/videos?limit=15`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (videosRes.ok) {
          const videosData = await videosRes.json();
          setSampleVideos(videosData.videos || []);
        }
      } catch (err) {
        console.error('Failed to load sample videos:', err);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load organization data");
    } finally {
      setLoading(false);
    }
  }, [user, organizationId, router]);

  useEffect(() => {
    if (user && organizationId) {
      loadData();
    }
  }, [user, organizationId, loadData]);

  // Listen for demo mode changes from header
  useEffect(() => {
    const saved = localStorage.getItem('sv-demo-mode');
    if (saved === 'true') setDemoMode(true);

    const handleDemoModeChange = (e: CustomEvent) => {
      setDemoMode(e.detail);
    };

    window.addEventListener('demo-mode-change', handleDemoModeChange as EventListener);
    return () => {
      window.removeEventListener('demo-mode-change', handleDemoModeChange as EventListener);
    };
  }, []);

  async function handleUpdateOrganization(data: Partial<Organization>) {
    if (!user || !organization) return;

    if (!data.name?.trim()) {
      toast.error("Organization name is required");
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/organizations/${organizationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name?.trim(),
          contactName: data.contactName?.trim() || undefined,
          contactEmail: data.contactEmail?.trim() || undefined,
          contactPhone: data.contactPhone?.trim() || undefined,
          status: data.status || "active",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update organization");
      }

      toast.success("Organization updated successfully");
      setShowEditOrg(false);
      await loadData();
    } catch (error: any) {
      console.error("Failed to update organization:", error);
      toast.error(error.message || "Failed to update organization");
    }
  }

  async function handleDeleteOrganization() {
    if (!user || !organization) return;

    if (
      !confirm(
        `Delete "${organization.name}"? This will also affect all associated data. This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/organizations/${organizationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete organization");
      }

      toast.success("Organization deleted");
      router.push("/admin/organizations");
    } catch (error: any) {
      console.error("Failed to delete organization:", error);
      toast.error(error.message || "Failed to delete organization");
    }
  }

  // Calculate stats for demo mode initialization
  const deliveryStats = useMemo(() => {
    const totalVideos = deliveries.reduce((sum, d) => sum + d.videoCount, 0);
    const totalStorageGB = deliveries.reduce((sum, d) => sum + d.sizeGB, 0);
    const totalHours = deliveries.reduce((sum, d) => sum + (d.hours || d.sizeGB / 15), 0);
    return {
      totalVideos,
      totalStorageGB,
      totalHours,
      deliveryCount: deliveries.length,
    };
  }, [deliveries]);

  const locationStats = useMemo(() => {
    let bedrooms = 0,
      bathrooms = 0,
      kitchens = 0,
      livingAreas = 0,
      other = 0,
      totalTasks = 0;

    assignedLocations.forEach((loc) => {
      bedrooms += loc.roomCounts?.bedroom || 0;
      bathrooms += loc.roomCounts?.bathroom || 0;
      kitchens += loc.roomCounts?.kitchen || 0;
      livingAreas += loc.roomCounts?.livingArea || 0;
      other += loc.roomCounts?.other || 0;
      totalTasks += loc.taskCount || 0;
    });

    return {
      totalLocations: assignedLocations.length,
      totalRooms: bedrooms + bathrooms + kitchens + livingAreas + other,
      bedrooms,
      bathrooms,
      kitchens,
      livingAreas,
      other,
      totalTasks,
    };
  }, [assignedLocations]);

  // Initialize editable stats when data loads or demo mode changes
  useEffect(() => {
    if (demoMode && organization) {
      const savedDemo = (organization as any).demoStats || {};
      setEditableStats({
        totalVideos: Math.round(savedDemo.totalVideos ?? deliveryStats.totalVideos ?? 0),
        totalHours: parseFloat((savedDemo.totalHours ?? deliveryStats.totalHours ?? 0).toFixed(1)),
        totalStorageGB: parseFloat((savedDemo.totalStorageGB ?? deliveryStats.totalStorageGB ?? 0).toFixed(1)),
        deliveryCount: Math.round(savedDemo.deliveryCount ?? deliveryStats.deliveryCount ?? 0),
        totalLocations: Math.round(savedDemo.totalLocations ?? locationStats.totalLocations ?? 0),
        bedrooms: Math.round(savedDemo.bedrooms ?? locationStats.bedrooms ?? 0),
        bathrooms: Math.round(savedDemo.bathrooms ?? locationStats.bathrooms ?? 0),
        kitchens: Math.round(savedDemo.kitchens ?? locationStats.kitchens ?? 0),
        livingAreas: Math.round(savedDemo.livingAreas ?? locationStats.livingAreas ?? 0),
        totalTasks: Math.round(savedDemo.totalTasks ?? locationStats.totalTasks ?? 0),
      });
    }
  }, [demoMode, organization]); // Remove deliveryStats and locationStats from dependencies

  // Initialize location stats values from organization data
  useEffect(() => {
    if (organization) {
      const stats = (organization as any).locationStats || {};
      setLocationStatsValues({
        locations: stats.locations ?? locationStats.totalLocations ?? 0,
        bedrooms: stats.bedrooms ?? locationStats.bedrooms ?? 0,
        bathrooms: stats.bathrooms ?? locationStats.bathrooms ?? 0,
        kitchens: stats.kitchens ?? locationStats.kitchens ?? 0,
        livingAreas: stats.livingAreas ?? locationStats.livingAreas ?? 0,
        totalTasks: stats.totalTasks ?? locationStats.totalTasks ?? 0,
      });
    }
  }, [organization, locationStats]);

  const saveDemoStats = async () => {
    if (!user || !organizationId) return;
    setSavingDemoStats(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(organizationId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ demoStats: editableStats }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to save demo stats:", error);
        alert("Failed to save demo values");
        return;
      }

      // Update local organization state with saved demoStats
      setOrganization(prev => prev ? { ...prev, demoStats: editableStats } as Organization : prev);
      
      // Show success feedback
      toast.success("Demo stats saved");
    } catch (err: any) {
      console.error("Failed to save demo stats:", err);
      alert("Failed to save demo values");
    } finally {
      setSavingDemoStats(false);
    }
  };

  const saveLocationStats = async () => {
    if (!user || !organizationId) return;
    setSavingLocationStats(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/organizations/${encodeURIComponent(organizationId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ locationStats: locationStatsValues }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to save location stats:", error);
        toast.error(error.error || "Failed to save location stats");
        return;
      }

      setOrganization(prev => prev ? { ...prev, locationStats: locationStatsValues } as Organization : prev);
      setEditingLocationStats(false);
      toast.success("Location stats saved successfully");
    } catch (err: any) {
      console.error("Failed to save location stats:", err);
      toast.error(err.message || "Failed to save location stats");
    } finally {
      setSavingLocationStats(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Organization not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-[#1f1f1f]">
        <div className="px-6 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.push("/admin/organizations")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{organization.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                    organization.status === "active"
                      ? "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-500/20 text-gray-800 dark:text-gray-400"
                  }`}
                >
                  {organization.status}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(() => {
                    // Try to get type from organization object (may not be in type definition but exists in data)
                    const orgType = (organization as any).type;
                    if (orgType === "oem_partner") return "OEM Partner";
                    if (orgType === "location_owner") return "Location Owner";
                    if (orgType === "supervolcano") return "SuperVolcano";
                    // Fallback: derive from ID prefix
                    if (organizationId.startsWith("oem:")) return "OEM Partner";
                    if (organizationId.startsWith("owner:")) return "Location Owner";
                    if (organizationId.startsWith("sv:")) return "SuperVolcano";
                    // Last fallback: check partnerId
                    return organization.partnerId ? "OEM Partner" : "Location Owner";
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => handleTabChange("overview")}
              icon={<BarChart3 className="w-4 h-4" />}
            >
              Overview
            </TabButton>
            <TabButton
              active={activeTab === "deliveries"}
              onClick={() => handleTabChange("deliveries")}
              icon={<Package className="w-4 h-4" />}
              count={deliveries.length}
            >
              Deliveries
            </TabButton>
            <TabButton
              active={activeTab === "locations"}
              onClick={() => handleTabChange("locations")}
              icon={<MapPin className="w-4 h-4" />}
              count={assignedLocations.length}
            >
              Locations
            </TabButton>
            <TabButton
              active={activeTab === "api"}
              onClick={() => handleTabChange("api")}
              icon={<Key className="w-4 h-4" />}
            >
              API Access
            </TabButton>
            <TabButton
              active={activeTab === "settings"}
              onClick={() => handleTabChange("settings")}
              icon={<Settings className="w-4 h-4" />}
            >
              Settings
            </TabButton>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-8">
        {activeTab === "overview" && (
          <OverviewTab
            organization={organization}
            deliveries={deliveries}
            assignedLocations={assignedLocations}
            sampleVideos={sampleVideos}
            onTabChange={handleTabChange}
            demoMode={demoMode}
            editableStats={editableStats}
            onEditableStatsChange={setEditableStats}
            onSaveDemoStats={saveDemoStats}
            savingDemoStats={savingDemoStats}
            deliveryStats={demoMode ? editableStats : undefined}
            locationStats={demoMode ? editableStats : undefined}
            editingLocationStats={editingLocationStats}
            setEditingLocationStats={setEditingLocationStats}
            locationStatsValues={locationStatsValues}
            setLocationStatsValues={setLocationStatsValues}
            saveLocationStats={saveLocationStats}
            savingLocationStats={savingLocationStats}
            selectedVideo={selectedVideo}
            setSelectedVideo={setSelectedVideo}
            setSampleVideos={setSampleVideos}
          />
        )}
        {activeTab === "deliveries" && (
          <DeliveriesTab
            deliveries={deliveries}
            organizationId={organizationId}
            organizationName={organization.name}
            onRefresh={loadData}
            sampleVideos={sampleVideos}
          />
        )}
        {activeTab === "locations" && (
          <LocationsTab
            assignedLocations={assignedLocations}
            availableLocations={availableLocations}
            organizationId={organizationId}
            organizationName={organization.name}
            onRefresh={loadData}
          />
        )}
        {activeTab === "api" && (
          <ApiAccessTab organization={organization} organizationId={organizationId} />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            organization={organization}
            onUpdate={handleUpdateOrganization}
            onDelete={handleDeleteOrganization}
          />
        )}
      </div>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  children,
  icon,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
        active
          ? "border-orange-500 text-orange-600 dark:text-orange-500"
          : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      }`}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${
            active
              ? "bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
              : "bg-gray-100 dark:bg-[#1f1f1f] text-gray-600 dark:text-gray-400"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// StatCard Helper Component
function StatCard({
  icon: Icon,
  label,
  value,
  small = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div
      className={`bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl ${
        small ? "p-4" : "p-6"
      }`}
    >
      <div className={`flex items-center ${small ? "gap-2" : "gap-3"}`}>
        <div
          className={`${small ? "w-8 h-8" : "w-10 h-10"} rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center`}
        >
          <Icon className={`${small ? "w-4 h-4" : "w-5 h-5"} text-orange-500`} />
        </div>
        <div>
          <p className={`${small ? "text-lg" : "text-2xl"} font-bold text-gray-900 dark:text-white`}>
            {value}
          </p>
          <p className={`${small ? "text-xs" : "text-sm"} text-gray-500 dark:text-gray-400`}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// EditableStatCard Component for Demo Mode
// EditableStatInput Component for Location Access editing
function EditableStatInput({ 
  icon: Icon, 
  label, 
  value, 
  onChange 
}: { 
  icon: any; 
  label: string; 
  value: number; 
  onChange: (val: number) => void;
}) {
  return (
    <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#1f1f1f] p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full text-lg font-bold text-gray-900 dark:text-white bg-transparent border-b border-dashed border-orange-400 dark:border-orange-500 focus:outline-none focus:border-orange-500 dark:focus:border-orange-400"
      />
    </div>
  );
}

function EditableStatCard({ 
  icon: Icon, 
  label, 
  value, 
  editValue,
  onEditChange,
  demoMode = false,
  small = false,
}: { 
  icon: any; 
  label: string; 
  value: string;
  editValue?: number;
  onEditChange?: (val: number) => void;
  demoMode?: boolean;
  small?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select all when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div className={`group relative bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#1f1f1f] ${small ? 'p-3' : 'p-4'}`}>
      {/* Edit button - only in demo mode, visible on hover */}
      {demoMode && !isEditing && onEditChange && (
        <button 
          onClick={() => setIsEditing(true)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded transition-all"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Icon className={`${small ? 'w-4 h-4' : 'w-5 h-5'} text-gray-400`} />
        <span className={`${small ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400`}>{label}</span>
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue?.toString() ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            // Allow empty, numbers, and decimals
            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
              onEditChange?.(val === '' ? 0 : parseFloat(val) || 0);
            }
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={`w-full bg-transparent border-b-2 border-blue-500 outline-none ${small ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}
        />
      ) : (
        <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 dark:text-white`}>
          {value}
        </div>
      )}
    </div>
  );
}

// OVERVIEW TAB
function OverviewTab({
  organization,
  deliveries,
  assignedLocations,
  sampleVideos,
  onTabChange,
  demoMode = false,
  editableStats,
  onEditableStatsChange,
  onSaveDemoStats,
  savingDemoStats = false,
  deliveryStats: passedDeliveryStats,
  locationStats: passedLocationStats,
  editingLocationStats,
  setEditingLocationStats,
  locationStatsValues,
  setLocationStatsValues,
  saveLocationStats,
  savingLocationStats,
  selectedVideo,
  setSelectedVideo,
  setSampleVideos,
}: {
  organization: Organization;
  deliveries: Delivery[];
  assignedLocations: AssignedLocation[];
  sampleVideos: Array<{
    id: string;
    url: string;
    fileName?: string;
    durationSeconds?: number;
    locationName?: string;
    roomType?: string;
  }>;
  onTabChange: (tab: TabType) => void;
  demoMode?: boolean;
  editableStats?: {
    totalVideos: number;
    totalHours: number;
    totalStorageGB: number;
    deliveryCount: number;
    totalLocations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  };
  onEditableStatsChange?: (stats: any) => void;
  onSaveDemoStats?: () => void;
  savingDemoStats?: boolean;
  deliveryStats?: {
    totalVideos: number;
    totalStorageGB: number;
    totalHours: number;
    deliveryCount: number;
  };
  locationStats?: {
    totalLocations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  };
  editingLocationStats: boolean;
  setEditingLocationStats: (value: boolean) => void;
  locationStatsValues: {
    locations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  };
  setLocationStatsValues: (value: {
    locations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  } | ((prev: {
    locations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  }) => {
    locations: number;
    bedrooms: number;
    bathrooms: number;
    kitchens: number;
    livingAreas: number;
    totalTasks: number;
  })) => void;
  saveLocationStats: () => Promise<void>;
  savingLocationStats: boolean;
  selectedVideo: { id: string; url: string; fileName?: string } | null;
  setSelectedVideo: (video: { id: string; url: string; fileName?: string } | null) => void;
  setSampleVideos: React.Dispatch<React.SetStateAction<Array<{ id: string; url: string; fileName?: string; durationSeconds?: number; locationName?: string; roomType?: string }>>>;
}) {
  // Remove video from samples
  const removeFromSamples = async (videoId: string) => {
    if (!confirm('Remove this video from partner samples?')) return;

    try {
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const response = await fetch(`/api/admin/exports/remove-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          partnerId: organization.id,
          videoId,
        }),
      });

      if (response.ok) {
        setSampleVideos(prev => prev.filter(v => v.id !== videoId));
        toast.success('Video removed from samples');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove video');
      }
    } catch (err) {
      console.error('Failed to remove video:', err);
      toast.error('Failed to remove video');
    }
  };

  // Calculate delivery stats
  const calculatedDeliveryStats = useMemo(() => {
    const totalVideos = deliveries.reduce((sum, d) => sum + d.videoCount, 0);
    const totalStorageGB = deliveries.reduce((sum, d) => sum + d.sizeGB, 0);
    const totalHours = deliveries.reduce((sum, d) => sum + (d.hours || d.sizeGB / 15), 0);
    const dates = deliveries.map((d) => new Date(d.date).getTime()).filter(Boolean);

    return {
      totalVideos,
      totalStorageGB,
      totalHours,
      deliveryCount: deliveries.length,
      firstDelivery: dates.length > 0 ? new Date(Math.min(...dates)) : null,
      lastDelivery: dates.length > 0 ? new Date(Math.max(...dates)) : null,
    };
  }, [deliveries]);

  // Use passed stats or calculated delivery stats
  const deliveryStats = passedDeliveryStats || calculatedDeliveryStats;

  // Calculate location stats
  const calculatedLocationStats = useMemo(() => {
    let bedrooms = 0,
      bathrooms = 0,
      kitchens = 0,
      livingAreas = 0,
      other = 0,
      totalTasks = 0;

    assignedLocations.forEach((loc) => {
      bedrooms += loc.roomCounts?.bedroom || 0;
      bathrooms += loc.roomCounts?.bathroom || 0;
      kitchens += loc.roomCounts?.kitchen || 0;
      livingAreas += loc.roomCounts?.livingArea || 0;
      other += loc.roomCounts?.other || 0;
      totalTasks += loc.taskCount || 0;
    });

    return {
      totalLocations: assignedLocations.length,
      totalRooms: bedrooms + bathrooms + kitchens + livingAreas + other,
      bedrooms,
      bathrooms,
      kitchens,
      livingAreas,
      other,
      totalTasks,
    };
  }, [assignedLocations]);

  // Use passed stats or calculated location stats
  const locationStats = passedLocationStats || calculatedLocationStats;

  // Chart data
  const chartData = useMemo(() => {
    if (deliveries.length < 2) return [];

    const sorted = [...deliveries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningTotal = 0;
    return sorted.map((d) => {
      runningTotal += d.videoCount;
      return {
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: runningTotal,
      };
    });
  }, [deliveries]);

  return (
    <div className="space-y-6">
      {/* Delivery Stats */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-500" />
          Data Delivered
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {demoMode && editableStats && onEditableStatsChange ? (
            <>
              <EditableStatCard
                icon={Film}
                label="Videos Delivered"
                value={editableStats.totalVideos.toLocaleString()}
                editValue={editableStats.totalVideos}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, totalVideos: val })}
                demoMode={demoMode}
              />
              <EditableStatCard
                icon={Clock}
                label="Hours of Footage"
                value={`${editableStats.totalHours.toFixed(1)} hrs`}
                editValue={editableStats.totalHours}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, totalHours: val })}
                demoMode={demoMode}
              />
              <EditableStatCard
                icon={HardDrive}
                label="Total Storage"
                value={
                  editableStats.totalStorageGB >= 1000
                    ? `${(editableStats.totalStorageGB / 1000).toFixed(1)} TB`
                    : `${editableStats.totalStorageGB.toFixed(1)} GB`
                }
                editValue={editableStats.totalStorageGB}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, totalStorageGB: val })}
                demoMode={demoMode}
              />
              <EditableStatCard
                icon={Package}
                label="Total Deliveries"
                value={editableStats.deliveryCount.toString()}
                editValue={editableStats.deliveryCount}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, deliveryCount: val })}
                demoMode={demoMode}
              />
            </>
          ) : (
            <>
              <StatCard
                icon={Film}
                label="Videos Delivered"
                value={deliveryStats.totalVideos.toLocaleString()}
              />
              <StatCard
                icon={Clock}
                label="Hours of Footage"
                value={`${deliveryStats.totalHours.toFixed(1)} hrs`}
              />
              <StatCard
                icon={HardDrive}
                label="Total Storage"
                value={
                  deliveryStats.totalStorageGB >= 1000
                    ? `${(deliveryStats.totalStorageGB / 1000).toFixed(1)} TB`
                    : `${deliveryStats.totalStorageGB.toFixed(1)} GB`
                }
              />
              <StatCard icon={Package} label="Total Deliveries" value={deliveryStats.deliveryCount.toString()} />
            </>
          )}
        </div>
        {demoMode && onSaveDemoStats && (
          <div className="flex justify-end mt-4">
            <button
              onClick={onSaveDemoStats}
              disabled={savingDemoStats}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {savingDemoStats ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Demo Values'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Recent Samples */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-500" />
            Recent Samples
          </h3>
          {sampleVideos.length > 7 && (
            <button
              onClick={() => onTabChange('deliveries')}
              className="text-sm text-orange-600 dark:text-orange-500 hover:underline"
            >
              View All →
            </button>
          )}
        </div>
        {sampleVideos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {sampleVideos.slice(0, 7).map((video) => (
              <div key={video.id} className="relative group">
                <VideoThumbnail
                  src={video.url}
                  className="w-full"
                  onClick={() => setSelectedVideo({ id: video.id, url: video.url, fileName: video.fileName })}
                />
                {video.durationSeconds && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                    {formatDuration(video.durationSeconds)}
                  </span>
                )}
                
                {/* Remove button - shows on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromSamples(video.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="Remove from samples"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* "More" card */}
            {sampleVideos.length > 7 && (
              <div
                className="aspect-video rounded-lg bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] flex items-center justify-center cursor-pointer hover:bg-gray-200 dark:hover:bg-[#242424] transition-colors"
                onClick={() => onTabChange('deliveries')}
              >
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  +{sampleVideos.length - 7} more
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
            <Film className="w-8 h-8 mb-2" />
            <p className="text-sm">No videos delivered yet</p>
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {selectedVideo && (
        <VideoPreviewModal
          src={selectedVideo.url}
          title={selectedVideo.fileName || 'Video'}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* Location Access Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Location Access</h3>
          </div>
          
          {!editingLocationStats ? (
            <button
              onClick={() => setEditingLocationStats(true)}
              className="text-sm text-orange-500 hover:text-orange-600 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingLocationStats(false)}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveLocationStats}
                disabled={savingLocationStats}
                className="text-sm bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
              >
                {savingLocationStats ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {editingLocationStats ? (
            <>
              <EditableStatInput 
                icon={Building2} 
                label="Locations" 
                value={locationStatsValues.locations}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, locations: val }))}
              />
              <EditableStatInput 
                icon={BedDouble} 
                label="Bedrooms" 
                value={locationStatsValues.bedrooms}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, bedrooms: val }))}
              />
              <EditableStatInput 
                icon={Bath} 
                label="Bathrooms" 
                value={locationStatsValues.bathrooms}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, bathrooms: val }))}
              />
              <EditableStatInput 
                icon={UtensilsCrossed} 
                label="Kitchens" 
                value={locationStatsValues.kitchens}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, kitchens: val }))}
              />
              <EditableStatInput 
                icon={Sofa} 
                label="Living Areas" 
                value={locationStatsValues.livingAreas}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, livingAreas: val }))}
              />
              <EditableStatInput 
                icon={ClipboardList} 
                label="Total Tasks" 
                value={locationStatsValues.totalTasks}
                onChange={(val) => setLocationStatsValues(prev => ({ ...prev, totalTasks: val }))}
              />
            </>
          ) : demoMode && editableStats && onEditableStatsChange ? (
            <>
              <EditableStatCard
                icon={Building2}
                label="Locations"
                value={editableStats.totalLocations.toString()}
                editValue={editableStats.totalLocations}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, totalLocations: val })}
                demoMode={demoMode}
                small
              />
              <EditableStatCard
                icon={BedDouble}
                label="Bedrooms"
                value={editableStats.bedrooms.toString()}
                editValue={editableStats.bedrooms}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, bedrooms: val })}
                demoMode={demoMode}
                small
              />
              <EditableStatCard
                icon={Bath}
                label="Bathrooms"
                value={editableStats.bathrooms.toString()}
                editValue={editableStats.bathrooms}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, bathrooms: val })}
                demoMode={demoMode}
                small
              />
              <EditableStatCard
                icon={UtensilsCrossed}
                label="Kitchens"
                value={editableStats.kitchens.toString()}
                editValue={editableStats.kitchens}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, kitchens: val })}
                demoMode={demoMode}
                small
              />
              <EditableStatCard
                icon={Sofa}
                label="Living Areas"
                value={editableStats.livingAreas.toString()}
                editValue={editableStats.livingAreas}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, livingAreas: val })}
                demoMode={demoMode}
                small
              />
              <EditableStatCard
                icon={ClipboardList}
                label="Total Tasks"
                value={editableStats.totalTasks.toString()}
                editValue={editableStats.totalTasks}
                onEditChange={(val) => onEditableStatsChange({ ...editableStats, totalTasks: val })}
                demoMode={demoMode}
                small
              />
            </>
          ) : (
            <>
              <StatCard icon={Building2} label="Locations" value={locationStatsValues.locations.toString()} small />
              <StatCard icon={BedDouble} label="Bedrooms" value={locationStatsValues.bedrooms.toString()} small />
              <StatCard icon={Bath} label="Bathrooms" value={locationStatsValues.bathrooms.toString()} small />
              <StatCard icon={UtensilsCrossed} label="Kitchens" value={locationStatsValues.kitchens.toString()} small />
              <StatCard icon={Sofa} label="Living Areas" value={locationStatsValues.livingAreas.toString()} small />
              <StatCard icon={ClipboardList} label="Total Tasks" value={locationStatsValues.totalTasks.toString()} small />
            </>
          )}
        </div>
        {demoMode && onSaveDemoStats && !editingLocationStats && (
          <div className="flex justify-end mt-4">
            <button
              onClick={onSaveDemoStats}
              disabled={savingDemoStats}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {savingDemoStats ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Demo Values'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Recent Deliveries */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Deliveries</h3>
        {deliveries.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No deliveries yet</p>
        ) : (
          <div className="space-y-3">
            {deliveries
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {delivery.videoCount} videos • {delivery.sizeGB.toFixed(1)} GB
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{delivery.description}</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(delivery.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// DELIVERIES TAB
function DeliveriesTab({
  deliveries,
  organizationId,
  organizationName,
  onRefresh,
  sampleVideos,
}: {
  deliveries: Delivery[];
  organizationId: string;
  organizationName: string;
  onRefresh: () => void;
  sampleVideos: Array<{
    id: string;
    url: string;
    fileName?: string;
    durationSeconds?: number;
    locationName?: string;
    roomType?: string;
  }>;
}) {
  const { getIdToken } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null);
  const [deliveryVideos, setDeliveryVideos] = useState<Record<string, any[]>>({});
  const [loadingDeliveryVideos, setLoadingDeliveryVideos] = useState<string | null>(null);
  const [newDelivery, setNewDelivery] = useState({
    date: new Date().toISOString().split("T")[0],
    videoCount: "",
    sizeGB: "",
    hours: "",
    description: "",
  });

  const loadDeliveryVideos = async (deliveryId: string) => {
    if (deliveryVideos[deliveryId]) return; // Already loaded

    setLoadingDeliveryVideos(deliveryId);
    try {
      const token = await getIdToken();
      if (!token) return;

      const res = await fetch(
        `/api/v1/organizations/${organizationId}/videos?deliveryId=${deliveryId}&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setDeliveryVideos(prev => ({ ...prev, [deliveryId]: data.videos || [] }));
      }
    } catch (err) {
      console.error('Failed to load delivery videos:', err);
    } finally {
      setLoadingDeliveryVideos(null);
    }
  };

  const handleAddDelivery = async () => {
    if (!newDelivery.videoCount || !newDelivery.sizeGB || !newDelivery.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const token = await getIdToken();
      const hours = newDelivery.hours ? parseFloat(newDelivery.hours) : parseFloat(newDelivery.sizeGB) / 15;

      const response = await fetch("/api/admin/data-intelligence/deliveries", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          date: newDelivery.date,
          videoCount: parseInt(newDelivery.videoCount),
          sizeGB: parseFloat(newDelivery.sizeGB),
          hours,
          description: newDelivery.description.trim(),
          partnerId: organizationId,
          partnerName: organizationName,
        }),
      });

      if (response.ok) {
        toast.success("Delivery logged successfully");
        setShowAddForm(false);
        setNewDelivery({
          date: new Date().toISOString().split("T")[0],
          videoCount: "",
          sizeGB: "",
          hours: "",
          description: "",
        });
        onRefresh();
      } else {
        toast.error("Failed to add delivery");
      }
    } catch (error) {
      console.error("Failed to add delivery:", error);
      toast.error("Failed to add delivery");
    }
  };

  // Chart data
  const chartData = useMemo(() => {
    if (deliveries.length < 2) return [];

    const sorted = [...deliveries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningTotal = 0;
    return sorted.map((d) => {
      runningTotal += d.videoCount;
      return {
        date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: runningTotal,
      };
    });
  }, [deliveries]);

  // Summary stats
  const stats = useMemo(() => {
    const totalVideos = deliveries.reduce((sum, d) => sum + d.videoCount, 0);
    const totalSize = deliveries.reduce((sum, d) => sum + d.sizeGB, 0);
    const totalHours = deliveries.reduce((sum, d) => sum + (d.hours || d.sizeGB / 15), 0);
    return { totalVideos, totalSize, totalHours };
  }, [deliveries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Package className="w-5 h-5 text-orange-500" />
          Delivery History
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Log Delivery
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard icon={Film} label="Total Videos" value={stats.totalVideos.toLocaleString()} />
        <StatCard icon={Clock} label="Total Hours" value={`${stats.totalHours.toFixed(1)} hrs`} />
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={
            stats.totalSize >= 1000
              ? `${(stats.totalSize / 1000).toFixed(1)} TB`
              : `${stats.totalSize.toFixed(1)} GB`
          }
        />
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cumulative Deliveries</h4>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#6b7280" }}
                axisLine={{ stroke: "#374151" }}
              />
              <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#374151" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f1f1f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value: number) => [`${value} videos`, "Total"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#f97316"
                fill="url(#deliveryGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Add Delivery Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Log New Delivery</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
              <input
                type="date"
                value={newDelivery.date}
                onChange={(e) => setNewDelivery({ ...newDelivery, date: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Videos *</label>
              <input
                type="number"
                value={newDelivery.videoCount}
                onChange={(e) => setNewDelivery({ ...newDelivery, videoCount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size (GB) *</label>
              <input
                type="number"
                step="0.01"
                value={newDelivery.sizeGB}
                onChange={(e) => setNewDelivery({ ...newDelivery, sizeGB: e.target.value, hours: "" })}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours</label>
              <input
                type="number"
                step="0.1"
                value={newDelivery.hours}
                onChange={(e) => setNewDelivery({ ...newDelivery, hours: e.target.value })}
                placeholder="Auto-calculated"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description *
            </label>
            <input
              type="text"
              value={newDelivery.description}
              onChange={(e) => setNewDelivery({ ...newDelivery, description: e.target.value })}
              placeholder="e.g., Kitchen cleaning data batch 1"
              className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddDelivery}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Save Delivery
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-[#1f1f1f] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Deliveries List with expandable previews */}
      {deliveries.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No deliveries recorded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((delivery) => (
              <div
                key={delivery.id}
                className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl overflow-hidden"
              >
                {/* Delivery header row */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors"
                  onClick={() => {
                    const newExpanded = expandedDelivery === delivery.id ? null : delivery.id;
                    setExpandedDelivery(newExpanded);
                    if (newExpanded) {
                      loadDeliveryVideos(delivery.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-4">
                    <button className="text-gray-400">
                      {expandedDelivery === delivery.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {delivery.description}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(delivery.date).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">{delivery.videoCount}</p>
                      <p className="text-gray-500 dark:text-gray-400">Videos</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {(delivery.hours || delivery.sizeGB / 15).toFixed(1)} hrs
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">Duration</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-white">{delivery.sizeGB.toFixed(1)} GB</p>
                      <p className="text-gray-500 dark:text-gray-400">Size</p>
                    </div>
                  </div>
                </div>

                {/* Expanded preview section */}
                {expandedDelivery === delivery.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-[#1f1f1f]">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      Sample videos from this delivery:
                    </p>
                    {loadingDeliveryVideos === delivery.id ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      </div>
                    ) : (
                      <VideoGallery
                        videos={deliveryVideos[delivery.id] || []}
                        maxVisible={8}
                        showViewAll={false}
                        emptyMessage="No preview videos available for this delivery"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// LOCATIONS TAB
function LocationsTab({
  assignedLocations,
  availableLocations,
  organizationId,
  organizationName,
  onRefresh,
}: {
  assignedLocations: AssignedLocation[];
  availableLocations: AssignedLocation[];
  organizationId: string;
  organizationName: string;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Calculate aggregate stats
  const stats = useMemo(() => {
    let bedrooms = 0,
      bathrooms = 0,
      kitchens = 0,
      livingAreas = 0,
      other = 0,
      totalTasks = 0;

    assignedLocations.forEach((loc) => {
      bedrooms += loc.roomCounts?.bedroom || 0;
      bathrooms += loc.roomCounts?.bathroom || 0;
      kitchens += loc.roomCounts?.kitchen || 0;
      livingAreas += loc.roomCounts?.livingArea || 0;
      other += loc.roomCounts?.other || 0;
      totalTasks += loc.taskCount || 0;
    });

    return {
      totalLocations: assignedLocations.length,
      totalRooms: bedrooms + bathrooms + kitchens + livingAreas + other,
      bedrooms,
      bathrooms,
      kitchens,
      livingAreas,
      other,
      totalTasks,
    };
  }, [assignedLocations]);

  const handleAssignLocation = async (locationId: string) => {
    if (!user) return;
    setAssigning(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/locations/${locationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignedOrganizationId: organizationId,
          assignedOrganizationName: organizationName,
        }),
      });

      if (response.ok) {
        toast.success("Location assigned successfully");
        setShowAssignModal(false);
        onRefresh();
      } else {
        toast.error("Failed to assign location");
      }
    } catch (error) {
      console.error("Failed to assign location:", error);
      toast.error("Failed to assign location");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignLocation = async (locationId: string, locationName: string) => {
    if (!user) return;
    if (!confirm(`Unassign "${locationName}" from "${organizationName}"?`)) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/v1/locations/${locationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          assignedOrganizationId: null,
          assignedOrganizationName: null,
        }),
      });

      if (response.ok) {
        toast.success("Location unassigned");
        onRefresh();
      } else {
        toast.error("Failed to unassign location");
      }
    } catch (error) {
      console.error("Failed to unassign location:", error);
      toast.error("Failed to unassign location");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Assigned Locations
        </h3>
        <button
          onClick={() => setShowAssignModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Assign Location
        </button>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard icon={Building2} label="Locations" value={stats.totalLocations.toString()} small />
        <StatCard icon={BedDouble} label="Bedrooms" value={stats.bedrooms.toString()} small />
        <StatCard icon={Bath} label="Bathrooms" value={stats.bathrooms.toString()} small />
        <StatCard icon={UtensilsCrossed} label="Kitchens" value={stats.kitchens.toString()} small />
        <StatCard icon={Sofa} label="Living Areas" value={stats.livingAreas.toString()} small />
        <StatCard icon={MapPin} label="Other Rooms" value={stats.other.toString()} small />
        <StatCard icon={ClipboardList} label="Total Tasks" value={stats.totalTasks.toString()} small />
      </div>

      {/* Locations Grid */}
      {assignedLocations.length === 0 ? (
        <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No locations assigned to this organization</p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Assign First Location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignedLocations.map((location) => (
            <div
              key={location.id}
              className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6 hover:shadow-md dark:hover:border-[#2a2a2a] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">{location.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{location.address}</p>
                </div>
                <button
                  onClick={() => handleUnassignLocation(location.id, location.name)}
                  className="text-sm text-orange-600 dark:text-orange-500 hover:text-orange-700 dark:hover:text-orange-400 font-medium"
                >
                  Unassign
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {(location.roomCounts?.bedroom || 0) +
                      (location.roomCounts?.bathroom || 0) +
                      (location.roomCounts?.kitchen || 0) +
                      (location.roomCounts?.livingArea || 0) +
                      (location.roomCounts?.other || 0)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rooms</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{location.taskCount || 0}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {location.totalSqFt ? `${location.totalSqFt.toLocaleString()}` : "—"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Sq Ft</p>
                </div>
              </div>

              <button
                onClick={() => router.push(`/admin/locations/${location.id}`)}
                className="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                View Details
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Assign Location Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#141414] rounded-xl border border-gray-200 dark:border-[#1f1f1f] w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-[#1f1f1f]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Location</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select a location to assign to {organizationName}
              </p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {availableLocations.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No unassigned locations available
                </p>
              ) : (
                <div className="space-y-3">
                  {availableLocations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => handleAssignLocation((location as any).locationId || location.id)}
                      disabled={assigning}
                      className="w-full p-4 text-left bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition-colors disabled:opacity-50"
                    >
                      <p className="font-medium text-gray-900 dark:text-white">{location.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{location.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-[#1f1f1f]">
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-[#1f1f1f] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// API ACCESS TAB
function ApiAccessTab({
  organization,
  organizationId,
}: {
  organization: Organization;
  organizationId: string;
}) {
  const [copied, setCopied] = useState(false);

  // Placeholder API key - in production, fetch from backend
  const apiKey = `sv_live_${organizationId.slice(0, 8)}...`;

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Key className="w-5 h-5 text-purple-500" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">API Access</h3>
      </div>

      {/* API Key Card */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Key</h4>
        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-[#1a1a1a] rounded-lg">
          <code className="flex-1 font-mono text-sm text-gray-900 dark:text-white">{apiKey}</code>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
          >
            {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-400" />}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
          Use this key to authenticate API requests for accessing training data.
        </p>
      </div>

      {/* API Documentation Link */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documentation</h4>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Learn how to integrate with the SuperVolcano API to access your training data programmatically.
        </p>
        <a
          href="/docs/api"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View API Documentation
        </a>
      </div>

      {/* Usage Stats Placeholder */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API Usage</h4>
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Usage statistics coming soon</p>
      </div>
    </div>
  );
}

// SETTINGS TAB
function SettingsTab({
  organization,
  onUpdate,
  onDelete,
}: {
  organization: Organization;
  onUpdate: (data: Partial<Organization>) => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: organization.name || "",
    contactName: organization.contactName || "",
    contactEmail: organization.contactEmail || "",
    contactPhone: organization.contactPhone || "",
    status: organization.status || "active",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(form);
      setEditing(false);
      toast.success("Organization updated");
    } catch (error) {
      toast.error("Failed to update organization");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-500" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h3>
      </div>

      {/* Organization Info */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Organization Information</h4>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg font-medium transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-[#1f1f1f] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Organization Name</p>
              <p className="text-gray-900 dark:text-white font-medium">{organization.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-white font-medium capitalize">{organization.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact Name</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {organization.contactName || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact Email</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {organization.contactEmail || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact Phone</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {organization.contactPhone || "Not set"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-[#141414] border border-red-200 dark:border-red-500/30 rounded-xl p-6">
        <h4 className="text-lg font-semibold text-red-600 dark:text-red-500 mb-4">Danger Zone</h4>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Deleting this organization will remove all associated data. This action cannot be undone.
        </p>
        <button
          onClick={onDelete}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Organization
        </button>
      </div>
    </div>
  );
}
