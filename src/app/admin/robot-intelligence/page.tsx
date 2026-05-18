"use client";

/**
 * ROBOT INTELLIGENCE DATABASE
 * SQL-based visual job database for robot learning
 * Clean UI with organized action menu
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Database,
  RefreshCw,
  Plus,
  Sparkles,
  Video,
  Filter,
  Loader2,
  CheckCircle2,
  Circle,
  Edit,
  Trash2,
  X,
  ChevronDown,
  Settings,
  AlertTriangle,
  Film,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  description: string;
  task_type: string;
  action_verb: string;
  object_target?: string;
  room_location?: string;
  sequence_order: number;
  human_verified: boolean;
  job_title: string;
  location_name: string;
  tags?: string[];
  media?: any[];
}

interface Stats {
  locations: number;
  shifts: number;
  tasks: number;
  executions: number;
  media: number;
}

export default function RobotIntelligencePage() {
  const router = useRouter();
  const { getIdToken, claims } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [filters, setFilters] = useState({
    taskType: "",
    humanVerified: undefined as boolean | undefined,
  });

  useEffect(() => {
    loadStats();
    loadTasks();
  }, []);

  async function loadStats() {
    try {
      const token = await getIdToken();
      const response = await fetch("/api/admin/robot-intelligence/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }

  async function loadTasks() {
    setLoading(true);
    try {
      const token = await getIdToken();
      const cacheBuster = Date.now();
      const params = new URLSearchParams();
      if (filters.taskType) params.set("taskType", filters.taskType);
      if (filters.humanVerified !== undefined)
        params.set("humanVerified", String(filters.humanVerified));

      const response = await fetch(
        `/api/admin/jobs?_=${cacheBuster}&${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const transformedTasks = data.jobs.map((job: any) => ({
            id: job.id,
            title: job.title,
            description: job.description || "",
            task_type: job.category || "general",
            action_verb: "",
            object_target: "",
            room_location: job.location_name || "",
            sequence_order: 0,
            human_verified: false,
            job_title: job.title,
            location_name: job.location_name || "",
            tags: [],
            media: Array.isArray(job.media)
              ? job.media.map((m: any) => ({
                  mediaId: m.id,
                  mediaType: m.file_type || "video/mp4",
                  storageUrl: m.storage_url,
                  thumbnailUrl: m.thumbnail_url,
                  durationSeconds: m.duration_seconds,
                }))
              : [],
          }));
          setTasks(transformedTasks);
        }
      }
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function syncData() {
    // Firestore is now the single source of truth for locations/jobs/tasks.
    // The Firestore→Postgres sync was removed in the 2026-05 schema redesign.
    alert(
      "Sync no longer needed — Firestore is the source of truth for locations, jobs, and tasks.",
    );
  }

  async function resetDatabase() {
    // The "reset SQL replica" feature went away with the Postgres tables it
    // targeted (jobs, tasks, media, locations all moved to Firestore).
    alert(
      "Reset no longer applicable — Postgres replica tables were removed in the 2026-05 redesign.",
    );
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!confirm(`Delete "${task?.title || "this task"}"?`)) return;
    try {
      const token = await getIdToken();
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        loadStats();
      } else {
        alert("Failed to delete task");
      }
    } catch (error: any) {
      alert("Failed to delete: " + error.message);
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] dark:bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 dark:bg-[#0a0a0a]">
      {/* Video Intelligence Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Link
          href="/admin/robot-intelligence/media"
          className="block p-6 bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md dark:hover:shadow-none transition-all"
        >
          <Film className="w-10 h-10 text-blue-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Media Library
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            View all uploaded videos, manage AI processing queue, and review
            annotation results.
          </p>
          <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center gap-1">
            Open Media Library <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/admin/robot-intelligence/training"
          className="block p-6 bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] hover:border-green-300 dark:hover:border-green-500/50 hover:shadow-md dark:hover:shadow-none transition-all"
        >
          <GraduationCap className="w-10 h-10 text-green-500 mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Training Library
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Curate anonymized training corpus, feature high-quality videos, and
            manage robot learning data.
          </p>
          <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1">
            Open Training Library <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Robot Intelligence Database
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            SQL-based visual job database for robot learning
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync Button - Primary Action */}
          <button
            onClick={syncData}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Firestore"}
          </button>
          {/* Create Task Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Task
          </button>
          {/* Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#2a2a2a] bg-white dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
            >
              <Settings className="h-4 w-4" />
              Actions
              <ChevronDown className="h-4 w-4" />
            </button>
            {showActionsMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActionsMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-[#2a2a2a] rounded-lg shadow-lg z-20">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowActionsMenu(false);
                        resetDatabase();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      Reset Database
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Locations"
          value={stats?.locations || 0}
          icon={Database}
          color="blue"
        />
        <StatCard
          label="Shifts"
          value={stats?.shifts || 0}
          icon={Database}
          color="purple"
        />
        <StatCard
          label="Tasks"
          value={stats?.tasks || 0}
          icon={Sparkles}
          color="green"
        />
        <StatCard
          label="Executions"
          value={stats?.executions || 0}
          icon={Database}
          color="orange"
        />
        <StatCard
          label="Media Files"
          value={stats?.media || 0}
          icon={Video}
          color="indigo"
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-lg p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <select
            value={filters.taskType}
            onChange={(e) =>
              setFilters({ ...filters, taskType: e.target.value })
            }
            className="px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg text-sm"
          >
            <option value="">All Types</option>
            <option value="action">Action</option>
            <option value="observation">Observation</option>
            <option value="decision">Decision</option>
            <option value="navigation">Navigation</option>
            <option value="manipulation">Manipulation</option>
          </select>
          <select
            value={
              filters.humanVerified === undefined
                ? ""
                : String(filters.humanVerified)
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                humanVerified:
                  e.target.value === "" ? undefined : e.target.value === "true",
              })
            }
            className="px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg text-sm"
          >
            <option value="">All Verification</option>
            <option value="true">Verified Only</option>
            <option value="false">Unverified Only</option>
          </select>
          <button
            onClick={loadTasks}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500/30 transition-colors text-sm"
          >
            Apply
          </button>
          {(filters.taskType || filters.humanVerified !== undefined) && (
            <button
              onClick={() => {
                setFilters({ taskType: "", humanVerified: undefined });
                setTimeout(loadTasks, 100);
              }}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-lg">
        <div className="p-4 border-b border-gray-200 dark:border-[#1f1f1f]">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Tasks ({tasks.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-[#1f1f1f]">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 dark:text-gray-500" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center">
              <Sparkles className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No tasks yet
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Create First Task
              </button>
            </div>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={() =>
                  router.push(`/admin/robot-intelligence/tasks/${task.id}`)
                }
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadTasks();
            loadStats();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <div className="bg-white dark:bg-[#141414] border border-gray-200 dark:border-[#1f1f1f] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {task.human_verified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            )}
            <h4 className="font-medium text-gray-900 dark:text-white truncate">
              {task.title}
            </h4>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                task.task_type === "action"
                  ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                  : task.task_type === "observation"
                    ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400"
                    : task.task_type === "decision"
                      ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400"
                      : task.task_type === "navigation"
                        ? "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
                        : "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400"
              }`}
            >
              {task.task_type}
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
            {task.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span>{task.location_name}</span>
            <span>•</span>
            <span>{task.job_title}</span>
            {task.media && task.media.length > 0 && (
              <>
                <span>•</span>
                <span className="text-purple-600 dark:text-purple-400">
                  {task.media.length} video{task.media.length > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateTaskModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { getIdToken, claims } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [formData, setFormData] = useState({
    locationId: "",
    jobId: "",
    title: "",
    description: "",
    taskType: "action" as
      | "action"
      | "observation"
      | "decision"
      | "navigation"
      | "manipulation",
    actionVerb: "",
    objectTarget: "",
    roomLocation: "",
    sequenceOrder: 1,
    estimatedDurationSeconds: 60,
    tags: "",
    humanVerified: false,
  });

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (formData.locationId) {
      loadJobs(formData.locationId);
    } else {
      setJobs([]);
    }
  }, [formData.locationId]);

  async function loadLocations() {
    try {
      const token = await getIdToken();
      const response = await fetch("/api/admin/robot-intelligence/locations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        console.log("[CreateTaskModal] Locations response:", data);
        setLocations(data.locations || []);
      }
    } catch (error) {
      console.error("Failed to load locations:", error);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadJobs(locationId: string) {
    setLoadingJobs(true);
    try {
      const token = await getIdToken();
      const response = await fetch(
        `/api/admin/locations/${locationId}/tasks/firestore`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const data = await response.json();
        setJobs(data.tasks || []);
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getIdToken();
      const organizationId = (claims as any)?.organizationId || "system";
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId,
          locationId: formData.locationId,
          jobId: formData.jobId,
          title: formData.title,
          description: formData.description,
          taskType: formData.taskType,
          actionVerb: formData.actionVerb,
          objectTarget: formData.objectTarget || undefined,
          roomLocation: formData.roomLocation || undefined,
          sequenceOrder: formData.sequenceOrder,
          estimatedDurationSeconds: formData.estimatedDurationSeconds,
          tags: formData.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          source: "manual_entry",
          humanVerified: formData.humanVerified,
          createdBy: (claims as any)?.email || "admin",
        }),
      });
      const data = await response.json();
      if (data.success) {
        onSuccess();
      } else {
        alert("Failed to create task: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      alert("Failed to create task: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#141414] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-200 dark:border-[#1f1f1f]">
        <div className="p-6 border-b border-gray-200 dark:border-[#1f1f1f] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create Task
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg"
          >
            <X className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Location *
              </label>
              {loadingLocations ? (
                <div className="px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 text-sm">
                  Loading...
                </div>
              ) : (
                <select
                  value={formData.locationId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      locationId: e.target.value,
                      jobId: "",
                    })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg"
                  required
                >
                  <option value="">Select location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              )}
              {locations.length === 0 && !loadingLocations && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  No locations. Sync from Firestore first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Job *
              </label>
              {!formData.locationId ? (
                <div className="px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 text-sm">
                  Select location first
                </div>
              ) : loadingJobs ? (
                <div className="px-3 py-2 border border-gray-300 dark:border-[#2a2a2a] rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-gray-400 text-sm">
                  Loading...
                </div>
              ) : (
                <select
                  value={formData.jobId}
                  onChange={(e) =>
                    setFormData({ ...formData, jobId: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg"
                  required
                >
                  <option value="">Select job</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg"
              rows={2}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task Type *
              </label>
              <select
                value={formData.taskType}
                onChange={(e) =>
                  setFormData({ ...formData, taskType: e.target.value as any })
                }
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg"
              >
                <option value="action">Action</option>
                <option value="observation">Observation</option>
                <option value="decision">Decision</option>
                <option value="navigation">Navigation</option>
                <option value="manipulation">Manipulation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action Verb *
              </label>
              <input
                type="text"
                value={formData.actionVerb}
                onChange={(e) =>
                  setFormData({ ...formData, actionVerb: e.target.value })
                }
                placeholder="e.g., wipe, open, place"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Object Target
              </label>
              <input
                type="text"
                value={formData.objectTarget}
                onChange={(e) =>
                  setFormData({ ...formData, objectTarget: e.target.value })
                }
                placeholder="e.g., counter, fridge"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Room
              </label>
              <input
                type="text"
                value={formData.roomLocation}
                onChange={(e) =>
                  setFormData({ ...formData, roomLocation: e.target.value })
                }
                placeholder="e.g., kitchen"
                className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              placeholder="e.g., cleaning, kitchen, daily"
              className="w-full px-3 py-2 bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="humanVerified"
              checked={formData.humanVerified}
              onChange={(e) =>
                setFormData({ ...formData, humanVerified: e.target.checked })
              }
            />
            <label
              htmlFor="humanVerified"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              Human Verified
            </label>
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-[#1f1f1f]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
