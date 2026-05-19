"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { db, storage } from "@/lib/firebaseClient";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  Film,
  RefreshCw,
  Play,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Square,
  CheckSquare,
  Minus,
  Star,
  X,
  Trash2,
  Database,
  Sparkles,
  Smartphone,
  HardDrive,
  Tag,
  AlertCircle,
  Upload,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { TabNav } from "@/components/ui/TabNav";
import { OverviewTab } from "@/components/admin/media-library/OverviewTab";
import { BlurReviewTab } from "@/components/admin/media-library/BlurReviewTab";
import { LabelReviewTab } from "@/components/admin/media-library/LabelReviewTab";
import { ExportTab } from "@/components/admin/media-library/ExportTab";
import BulkEditModal from "@/components/admin/media-library/BulkEditModal";
import { DriveFolderPicker } from "@/components/admin/DriveFolderPicker";

export interface VideoItem {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl: string | null;
  locationId: string | null;
  locationName: string | null;
  uploadedAt: string | null;
  userId?: string | null;
  source?: string;
  reviewStatus?: "pending" | "approved" | "rejected";
  blurStatus?: "none" | "processing" | "complete" | "failed";
  importSource?: string;
  aiStatus: "pending" | "processing" | "completed" | "failed";
  aiAnnotations: any | null;
  aiError: string | null;
  duration: number | null;
  size: number | null;
  aiRoomType: string | null;
  aiActionTypes: string[];
  aiObjectLabels: string[];
  aiQualityScore: number | null;
  trainingStatus: "pending" | "approved" | "rejected";
  faceDetectionStatus?: "pending" | "processing" | "completed" | "failed";
  hasFaces?: boolean;
  faceCount?: number;
  faceTimestamps?: { startTime: number; endTime: number }[];
  faceDetectionError?: string;
  blurApproved?: boolean;
  blurredUrl?: string;
  updatedAt?: string;
  contributorName?: string | null;
  contributorType?: string | null;
  contributorId?: string | null;
  contributorOrgId?: string | null;
}

interface Stats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  blurPending: number;
  pendingApproval: number;
  approved: number;
  rejected: number;
}

export default function MediaLibraryPage() {
  const { user } = useAuth();
  const [media, setMedia] = useState<VideoItem[]>([]);
  const [stats, setStats] = useState<Stats>({
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    blurPending: 0,
    pendingApproval: 0,
    approved: 0,
    rejected: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [trainingFilter, setTrainingFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterContributor, setFilterContributor] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "blur" | "labels" | "export"
  >("overview");
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [singleActionLoading, setSingleActionLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [objectsExpanded, setObjectsExpanded] = useState(false);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [blurringIds, setBlurringIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // Import dropdown state
  const [showImportDropdown, setShowImportDropdown] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importAttribution, setImportAttribution] = useState<string>("");
  const [importUploading, setImportUploading] = useState(false);
  const [importProgress, setImportProgress] = useState<Map<string, number>>(
    new Map(),
  );

  // Google Drive import state
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [driveImportProgress, setDriveImportProgress] = useState<{
    isImporting: boolean;
    current: number;
    total: number;
    currentFile: string;
    status: "listing" | "importing" | "done" | "error";
    message: string;
  } | null>(null);

  const fetchMedia = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = await user.getIdToken();

      // Auto-fix stuck uploads first (silent)
      try {
        const fixResponse = await fetch(
          "/api/admin/migrate/fix-stuck-uploads",
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const fixData = await fixResponse.json();
        if (fixData.stats?.fixed > 0) {
          console.log(
            `[Media Library] Auto-fixed ${fixData.stats.fixed} stuck uploads`,
          );
        }
      } catch (fixErr) {
        // Silent fail
      }

      // Then fetch videos
      const params = new URLSearchParams();
      if (filter && filter !== "all") params.append("status", filter);
      params.append("limit", "200");

      const response = await fetch(`/api/admin/videos?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch videos");
      const data = await response.json();
      setMedia(data.videos || []);
      setStats(
        data.stats || {
          queued: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          blurPending: 0,
          pendingApproval: 0,
          approved: 0,
          rejected: 0,
        },
      );
      setTotalCount(data.pagination?.total || data.videos?.length || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, filter]);

  // Extract filter options and apply filters
  const { filteredVideos, availableLocations, availableContributors } =
    useMemo(() => {
      // Extract unique locations and contributors
      const locations = new Map<string, string>();
      const contributors = new Set<string>();

      media.forEach((v) => {
        if (v.locationId && v.locationName) {
          locations.set(v.locationId, v.locationName);
        }
        if (v.contributorName) {
          contributors.add(v.contributorName);
        }
      });

      // Apply location and contributor filters
      let filtered = media.filter((video) => {
        if (filterLocation && video.locationId !== filterLocation) {
          return false;
        }
        if (filterContributor && video.contributorName !== filterContributor) {
          return false;
        }
        return true;
      });

      // Apply training status filter
      if (trainingFilter !== "all") {
        filtered = filtered.filter((v) => {
          if (trainingFilter === "pending") {
            return v.trainingStatus === "pending" && v.aiStatus === "completed";
          }
          return v.trainingStatus === trainingFilter;
        });
      }

      return {
        filteredVideos: filtered,
        availableLocations: Array.from(locations.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        availableContributors: Array.from(contributors).sort(),
      };
    }, [media, filterLocation, filterContributor, trainingFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Click-outside handler for import dropdown
  useEffect(() => {
    const handleClickOutside = () => setShowImportDropdown(false);
    if (showImportDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showImportDropdown]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedVideoIndex === null) return;
      if (e.key === "Escape") {
        setSelectedVideoIndex(null);
        setObjectsExpanded(false);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateModal(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigateModal(1);
      } else if (
        (e.key === "a" || e.key === "A") &&
        filteredVideos[selectedVideoIndex]?.aiStatus === "completed"
      ) {
        handleSingleAction(filteredVideos[selectedVideoIndex].id, "approve");
      } else if (
        (e.key === "r" || e.key === "R") &&
        filteredVideos[selectedVideoIndex]?.aiStatus === "completed"
      ) {
        handleSingleAction(filteredVideos[selectedVideoIndex].id, "reject");
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !deleteLoading
      ) {
        handleSingleDelete(filteredVideos[selectedVideoIndex].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedVideoIndex, media, deleteLoading]);

  // Reset objectsExpanded when selectedVideoIndex changes
  useEffect(() => {
    setObjectsExpanded(false);
  }, [selectedVideoIndex]);

  const navigateModal = (direction: number) => {
    if (selectedVideoIndex === null) return;
    const newIndex = selectedVideoIndex + direction;
    if (newIndex >= 0 && newIndex < filteredVideos.length) {
      setSelectedVideoIndex(newIndex);
      setObjectsExpanded(false); // Reset expansion when navigating
    }
  };

  const toggleSelection = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (event.shiftKey && lastSelectedId) {
      const lastIndex = filteredVideos.findIndex(
        (v) => v.id === lastSelectedId,
      );
      const currentIndex = filteredVideos.findIndex((v) => v.id === id);
      const [start, end] = [
        Math.min(lastIndex, currentIndex),
        Math.max(lastIndex, currentIndex),
      ];
      for (let i = start; i <= end; i++) newSelected.add(filteredVideos[i].id);
    } else {
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setLastSelectedId(id);
  };

  const selectAll = () =>
    setSelectedIds(new Set(filteredVideos.map((v) => v.id)));
  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  };
  const allSelected =
    filteredVideos.length > 0 &&
    filteredVideos.every((v) => selectedIds.has(v.id));
  const someSelected = selectedIds.size > 0;

  const handleAnalyze = async (mediaId: string) => {
    if (!user || analyzeLoading) return;
    setAnalyzeLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaId, action: "process_single" }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Analysis failed");
      }
      if (!result.success) {
        if (result.skipped) {
          setError(
            result.error || "Video requires face blur before AI processing",
          );
        } else {
          throw new Error(result.error || "Analysis did not complete");
        }
        return;
      }
      // Refresh to get updated status
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleReanalyze = async (mediaId: string) => {
    if (!user || reanalyzingId) return;
    setReanalyzingId(mediaId);
    setError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaId, action: "reanalyze" }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Re-analyze failed");
      }
      // Refresh to get updated data
      await fetchMedia();

      // Poll for completion (check every 2 seconds, max 30 times = 60 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;

        // Fetch fresh data
        try {
          const token = await user.getIdToken();
          const params = new URLSearchParams();
          if (filter && filter !== "all") params.append("status", filter);
          params.append("limit", "200");

          const response = await fetch(`/api/admin/videos?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            const updatedVideo = data.videos?.find(
              (v: VideoItem) => v.id === mediaId,
            );

            if (
              updatedVideo &&
              (updatedVideo.aiStatus === "completed" ||
                updatedVideo.aiStatus === "failed")
            ) {
              clearInterval(pollInterval);
              setReanalyzingId(null);
              await fetchMedia(); // Final refresh to update UI
              return;
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setReanalyzingId(null);
        }
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setReanalyzingId(null);
    }
  };

  const handleSingleAction = async (
    mediaId: string,
    action: "approve" | "reject",
  ) => {
    if (!user || singleActionLoading) return;
    setSingleActionLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/approve-training", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaIds: [mediaId], action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Action failed");
      if (result?.failed?.length) {
        throw new Error(result.failed[0]?.error || `${action} failed`);
      }
      await fetchMedia();
      if (selectedVideoIndex !== null) {
        const nextPending = filteredVideos.findIndex(
          (v, i) =>
            i > selectedVideoIndex &&
            v.aiStatus === "completed" &&
            v.trainingStatus === "pending",
        );
        if (nextPending !== -1) setSelectedVideoIndex(nextPending);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSingleActionLoading(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0 || bulkActionLoading || !user) return;
    setBulkActionLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/approve-training", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaIds: Array.from(selectedIds), action }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Bulk action failed");
      if (result?.failed?.length) {
        const sample = result.failed[0]?.error || `${action} failed`;
        throw new Error(
          `${result.failed.length}/${result.total} failed: ${sample}`,
        );
      }
      clearSelection();
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSingleDelete = async (mediaId: string) => {
    if (!user || deleteLoading) return;
    if (!confirm("Delete this video? This cannot be undone.")) return;
    setDeleteLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/videos/${mediaId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Delete failed");
      if (selectedVideoIndex !== null) {
        if (filteredVideos.length <= 1) setSelectedVideoIndex(null);
        else if (selectedVideoIndex >= filteredVideos.length - 1)
          setSelectedVideoIndex(selectedVideoIndex - 1);
      }
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || bulkActionLoading || !user) return;
    if (!confirm(`Delete ${selectedIds.size} video(s)? This cannot be undone.`))
      return;
    setBulkActionLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaIds: Array.from(selectedIds) }),
      });
      if (!response.ok) throw new Error("Bulk delete failed");
      clearSelection();
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const processBatch = async () => {
    if (!user || isProcessingBatch) return;
    setIsProcessingBatch(true);
    try {
      setError(null);
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/videos/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "process_batch", batchSize: 5 }),
      });
      const result = await response.json();
      if (result.skipped > 0) {
        setError(
          `Processed ${result.processed} videos. Skipped ${result.skipped} (blur pending).`,
        );
      } else if (result.processed > 0) {
        setError(null); // Clear any previous errors
      }
      await fetchMedia();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Blur handlers
  const handleApplyBlur = async (videoId: string) => {
    if (!user) return;
    setBlurringIds((prev) => new Set(prev).add(videoId));
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/contributions/blur", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaId: videoId, action: "blur" }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || "Blur failed");
      }
      await fetchMedia();
    } catch (err: any) {
      setError(err.message || "Blur error");
    } finally {
      setBlurringIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const handleBackfillDuration = async () => {
    if (!user || backfillProgress) return;

    try {
      const token = await user.getIdToken();

      // Get videos needing duration
      const response = await fetch("/api/admin/migrate/backfill-duration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ batchSize: 50 }),
      });

      const data = await response.json();
      if (!data.videos || data.videos.length === 0) {
        alert("No videos need duration backfill");
        return;
      }

      setBackfillProgress({ current: 0, total: data.videos.length });

      // Process each video client-side
      for (let i = 0; i < data.videos.length; i++) {
        const video = data.videos[i];
        setBackfillProgress({ current: i + 1, total: data.videos.length });

        try {
          // Extract duration using video element
          const duration = await new Promise<number>((resolve) => {
            const videoEl = document.createElement("video");
            videoEl.preload = "metadata";
            videoEl.onloadedmetadata = () => {
              resolve(Math.round(videoEl.duration));
            };
            videoEl.onerror = () => resolve(0);
            videoEl.src = video.url;
          });

          if (duration > 0) {
            // Save to Firestore
            await fetch("/api/admin/migrate/backfill-duration", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                videoId: video.id,
                durationSeconds: duration,
              }),
            });
          }
        } catch (err) {
          console.error(`Failed to process ${video.fileName}:`, err);
        }
      }

      alert(`Backfilled duration for ${data.videos.length} videos`);
      fetchMedia(); // Refresh
    } catch (err: any) {
      console.error("Backfill error:", err);
      alert("Backfill failed: " + err.message);
    } finally {
      setBackfillProgress(null);
    }
  };

  const handleApproveBlur = async (videoId: string) => {
    if (!user) return;
    setProcessingIds((prev) => new Set(prev).add(videoId));
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/videos/${videoId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewStatus: "approved" }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Approval failed");
      }
      await fetchMedia();
    } catch (err: any) {
      setError(err.message || "Approval error");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const handleRejectBlur = async (videoId: string) => {
    if (!user) return;
    setProcessingIds((prev) => new Set(prev).add(videoId));
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/videos/${videoId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reviewStatus: "rejected" }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Rejection failed");
      }
      await fetchMedia();
    } catch (err: any) {
      setError(err.message || "Rejection error");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "-";
    try {
      const date = new Date(d);
      return isNaN(date.getTime()) ? "-" : date.toLocaleDateString();
    } catch {
      return "-";
    }
  };
  const formatDuration = (s: number | null) => {
    if (!s || s <= 0) return "-";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60)
      .toString()
      .padStart(2, "0")}`;
  };
  const formatSize = (b: number | null) =>
    b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "-";
  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // Get processing status with unified pipeline logic
  const getProcessingStatus = (
    video: VideoItem,
  ): {
    label: string;
    variant: "warning" | "info" | "processing" | "success" | "error";
    icon: JSX.Element;
  } => {
    // Only videos that explicitly have reviewStatus field AND it's not approved
    const needsBlur =
      typeof video.reviewStatus === "string" &&
      video.reviewStatus !== "approved";

    // Check blur first
    if (needsBlur) {
      return {
        label: "Blur Pending",
        variant: "warning",
        icon: <Clock className="w-4 h-4" />,
      };
    }

    // Then check AI status
    if (video.aiStatus === "failed") {
      return {
        label: "Failed",
        variant: "error",
        icon: <XCircle className="w-4 h-4" />,
      };
    }
    if (video.aiStatus === "processing") {
      return {
        label: "Processing",
        variant: "processing",
        icon: <RefreshCw className="w-4 h-4 animate-spin" />,
      };
    }
    if (video.aiStatus === "completed") {
      return {
        label: "Ready",
        variant: "success",
        icon: <CheckCircle className="w-4 h-4" />,
      };
    }

    // Default: needs CV labeling
    return {
      label: "Labels Pending",
      variant: "info",
      icon: <Tag className="w-4 h-4" />,
    };
  };

  const getProcessingStatusBadge = (video: VideoItem) => {
    const status = getProcessingStatus(video);
    const variantClasses = {
      warning:
        "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30",
      info: "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
      processing:
        "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30",
      success:
        "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30",
      error:
        "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${variantClasses[status.variant]}`}
      >
        {status.icon}
        {status.label}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "processing":
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };
  const getTrainingBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-[#1f1f1f] text-gray-500 dark:text-gray-400">
            -
          </span>
        );
    }
  };
  const renderStars = (score: number | null) => {
    if (score === null) return "-";
    const stars = Math.round(score * 5);
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${i < stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
          />
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          {Math.round(score * 100)}%
        </span>
      </div>
    );
  };

  const selectedVideo =
    selectedVideoIndex !== null ? filteredVideos[selectedVideoIndex] : null;

  // Helper functions
  const extractVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => resolve(0);
      video.src = URL.createObjectURL(file);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Handle admin import
  const handleImport = async () => {
    if (!user || importFiles.length === 0) return;

    setImportUploading(true);
    const progressMap = new Map<string, number>();

    try {
      for (const file of importFiles) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `contributions/${user.uid}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        // Upload with progress tracking
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              progressMap.set(file.name, progress);
              setImportProgress(new Map(progressMap));
            },
            reject,
            async () => {
              try {
                const url = await getDownloadURL(uploadTask.snapshot.ref);

                // Extract duration if video
                let durationSeconds = 0;
                if (file.type.startsWith("video/")) {
                  durationSeconds = await extractVideoDuration(file);
                }

                // Create media document - AUTO APPROVED
                await addDoc(collection(db, "media"), {
                  contributorId: user.uid,
                  contributorEmail: user.email || "admin@supervolcano.ai",
                  contributorName: importAttribution.trim() || "Admin Import",
                  fileName: file.name,
                  fileSize: file.size,
                  mimeType: file.type,
                  url,
                  storagePath,
                  durationSeconds,
                  locationText: null,
                  source: "web_contribute",
                  reviewStatus: "approved", // Auto-approve for admin
                  reviewedAt: serverTimestamp(),
                  reviewedBy: user.uid,
                  blurStatus: "none",
                  blurredUrl: null,
                  blurredStoragePath: null,
                  facesDetected: null,
                  blurError: null,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });

                resolve();
              } catch (err) {
                reject(err);
              }
            },
          );
        });
      }

      // Success - close modal and reset
      setShowImportModal(false);
      setImportFiles([]);
      setImportAttribution("");
      setImportProgress(new Map());
      fetchMedia(); // Refresh the list
    } catch (error) {
      console.error("Import error:", error);
      alert("Import failed. Check console for details.");
    } finally {
      setImportUploading(false);
    }
  };

  // Handle file drop/select
  const handleImportFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImportFiles(Array.from(e.target.files));
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("video/"),
    );
    setImportFiles(files);
  };

  return (
    <div className="p-6 dark:bg-[#0a0a0a]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Media Library
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage and process video content for AI analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Secondary actions - subtle styling */}
          <div className="flex items-center">
            {/* Import dropdown - outline style */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImportDropdown(!showImportDropdown);
                }}
                className="px-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2 text-sm font-medium"
              >
                <Upload className="w-4 h-4" />
                Import
                <ChevronDown className="w-3 h-3" />
              </button>

              {showImportDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1f1f1f] rounded-lg shadow-lg border border-gray-200 dark:border-[#2a2a2a] z-10">
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                      setShowImportDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2 rounded-t-lg"
                  >
                    <Upload className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    From Device
                  </button>
                  <button
                    onClick={() => {
                      setShowDrivePicker(true);
                      setShowImportDropdown(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2 rounded-b-lg"
                  >
                    <HardDrive className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    From Google Drive
                  </button>
                </div>
              )}
            </div>

            {/* Refresh - icon button, matches import height */}
            <button
              onClick={fetchMedia}
              disabled={loading}
              className="ml-2 p-2 text-gray-500 dark:text-gray-400 bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] hover:text-gray-700 dark:hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>

            {/* Backfill Duration button */}
            <button
              onClick={handleBackfillDuration}
              disabled={!!backfillProgress}
              className="ml-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#2a2a2a] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2a2a2a] flex items-center gap-2"
            >
              {backfillProgress ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {backfillProgress.current}/{backfillProgress.total}
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  Backfill Duration
                </>
              )}
            </button>
          </div>

          {/* Primary action - stands out */}
          {activeTab === "overview" && (
            <>
              <button
                onClick={processBatch}
                disabled={isProcessingBatch}
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                Process Batch
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      {(() => {
        // Calculate tab counts
        const blurPendingCount = media.filter((v) => {
          // No blur status or not complete = needs blur
          if (!v.blurStatus || v.blurStatus === "none") return true;
          // Has reviewStatus that's not approved = needs review
          if (
            typeof v.reviewStatus === "string" &&
            v.reviewStatus !== "approved"
          )
            return true;
          return false;
        }).length;
        const labelsPendingCount = media.filter(
          (v) => v.aiStatus === "pending" || !v.aiStatus,
        ).length;
        const exportReadyCount = media.filter(
          (v) => v.reviewStatus === "approved",
        ).length;

        const tabs = [
          { id: "overview", label: "Overview" },
          { id: "blur", label: "Blur Review", count: blurPendingCount },
          { id: "labels", label: "Label Review", count: labelsPendingCount },
          { id: "export", label: "Export", count: exportReadyCount },
        ];

        return (
          <TabNav
            tabs={tabs}
            activeTab={activeTab}
            onChange={(id) =>
              setActiveTab(id as "overview" | "blur" | "labels" | "export")
            }
          />
        );
      })()}

      {/* Filter Bar */}
      <div className="flex items-center gap-4 mb-6 px-4 py-3 bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f]">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Filter className="w-4 h-4" />
          <span>Filters:</span>
        </div>

        {/* Location Filter */}
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Locations</option>
          {availableLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        {/* Contributor Filter */}
        <select
          value={filterContributor}
          onChange={(e) => setFilterContributor(e.target.value)}
          className="px-3 py-1.5 text-sm bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Contributors</option>
          {availableContributors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {(filterLocation || filterContributor) && (
          <button
            onClick={() => {
              setFilterLocation("");
              setFilterContributor("");
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Clear
          </button>
        )}

        {/* Results count */}
        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {filteredVideos.length} of {media.length} videos
        </div>
      </div>

      {/* Import Progress Banner */}
      {driveImportProgress && (
        <div
          className={`mb-6 p-4 rounded-xl border ${
            driveImportProgress.status === "error"
              ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20"
              : driveImportProgress.status === "done"
                ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20"
                : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20"
          }`}
        >
          <div className="flex items-center gap-3">
            {driveImportProgress.status === "listing" ||
            driveImportProgress.status === "importing" ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            ) : driveImportProgress.status === "done" ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}

            <div className="flex-1">
              <p
                className={`font-medium ${
                  driveImportProgress.status === "error"
                    ? "text-red-700 dark:text-red-400"
                    : driveImportProgress.status === "done"
                      ? "text-green-700 dark:text-green-400"
                      : "text-blue-700 dark:text-blue-400"
                }`}
              >
                {driveImportProgress.message}
              </p>

              {driveImportProgress.status === "importing" &&
                driveImportProgress.total > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <span>Importing: {driveImportProgress.currentFile}</span>
                      <span>
                        {driveImportProgress.current} /{" "}
                        {driveImportProgress.total}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-[#1f1f1f] rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(driveImportProgress.current / driveImportProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
            </div>

            {(driveImportProgress.status === "done" ||
              driveImportProgress.status === "error") && (
              <button
                onClick={() => setDriveImportProgress(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          className={`mb-4 p-4 border rounded-lg ${
            error.includes("Skipped") || error.includes("blur pending")
              ? "bg-yellow-50 border-yellow-200 text-yellow-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {error}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "overview" && (
        <OverviewTab
          media={filteredVideos}
          filteredMedia={filteredVideos}
          stats={stats}
          totalCount={totalCount}
          filter={filter}
          setFilter={setFilter}
          trainingFilter={trainingFilter}
          setTrainingFilter={setTrainingFilter}
          formatTotalDuration={formatTotalDuration}
          loading={loading}
          error={error}
          selectedIds={selectedIds}
          allSelected={allSelected}
          someSelected={someSelected}
          selectAll={selectAll}
          clearSelection={clearSelection}
          toggleSelection={toggleSelection}
          setSelectedVideoIndex={setSelectedVideoIndex}
          formatDuration={formatDuration}
          formatSize={formatSize}
          formatDate={formatDate}
          getProcessingStatusBadge={getProcessingStatusBadge}
          getTrainingBadge={getTrainingBadge}
        />
      )}
      {activeTab === "blur" && (
        <BlurReviewTab
          media={filteredVideos}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
          onSelectAll={(ids) => setSelectedIds(new Set(ids))}
          onApplyBlur={handleApplyBlur}
          onApproveBlur={handleApproveBlur}
          onRejectBlur={handleRejectBlur}
          blurringIds={blurringIds}
          processingIds={processingIds}
          formatDate={formatDate}
          onVideoClick={(video) => {
            const index = filteredVideos.findIndex((v) => v.id === video.id);
            setSelectedVideoIndex(index !== -1 ? index : null);
          }}
        />
      )}
      {activeTab === "labels" && (
        <LabelReviewTab
          media={filteredVideos}
          onProcessBatch={processBatch}
          processing={isProcessingBatch}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
          onSelectAll={() => {
            const needsLabels = filteredVideos.filter(
              (v) => v.aiStatus === "pending" || !v.aiStatus,
            );
            setSelectedIds(new Set(needsLabels.map((v) => v.id)));
          }}
          formatDuration={formatDuration}
          formatDate={formatDate}
          onVideoClick={(video) => {
            const index = filteredVideos.findIndex((v) => v.id === video.id);
            setSelectedVideoIndex(index !== -1 ? index : null);
          }}
        />
      )}
      {activeTab === "export" && (
        <ExportTab
          media={filteredVideos}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelection}
          onSelectAll={(ids) => setSelectedIds(new Set(ids))}
          formatDuration={formatDuration}
          formatDate={formatDate}
        />
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-blue-400" />
            <span className="font-medium">{selectedIds.size} selected</span>
          </div>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={clearSelection}
            className="px-3 py-1 text-sm hover:bg-gray-800 rounded"
          >
            Clear
          </button>
          <button
            onClick={() => setShowBulkEditModal(true)}
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-1"
          >
            <Tag className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkActionLoading}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={() => handleBulkAction("reject")}
            disabled={bulkActionLoading}
            className="px-3 py-1 text-sm bg-orange-600 hover:bg-orange-700 rounded"
          >
            Reject
          </button>
          <button
            onClick={() => handleBulkAction("approve")}
            disabled={bulkActionLoading}
            className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700 rounded flex items-center gap-1"
          >
            {bulkActionLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Approve
          </button>
        </div>
      )}

      {selectedVideo && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setSelectedVideoIndex(null)}
        >
          <div
            className="bg-white dark:bg-[#141414] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#1f1f1f] sticky top-0 bg-white dark:bg-[#141414] z-10">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigateModal(-1)}
                  disabled={selectedVideoIndex === 0}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg disabled:opacity-30"
                  title="Previous"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {(selectedVideoIndex ?? 0) + 1} of {filteredVideos.length}
                </span>
                <button
                  onClick={() => navigateModal(1)}
                  disabled={selectedVideoIndex === filteredVideos.length - 1}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg disabled:opacity-30"
                  title="Next"
                >
                  <ChevronRight className="w-5 h-5 text-gray-900 dark:text-white" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSingleDelete(selectedVideo.id)}
                  disabled={deleteLoading}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedVideoIndex(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-900 dark:text-white" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-black flex items-center justify-center">
              <video
                src={selectedVideo.url}
                controls
                autoPlay
                className="max-h-[60vh] max-w-full object-contain"
              />
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedVideo.fileName}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedVideo.locationName || "Unknown location"} •{" "}
                  {formatDate(selectedVideo.uploadedAt)}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Duration
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatDuration(selectedVideo.duration)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Size</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {formatSize(selectedVideo.size)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">
                    AI Status
                  </div>
                  <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                    {getStatusIcon(selectedVideo.aiStatus)}
                    <span className="capitalize">{selectedVideo.aiStatus}</span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Training
                  </div>
                  <div>{getTrainingBadge(selectedVideo.trainingStatus)}</div>
                </div>
              </div>

              {/* Analyze Section - Show when pending */}
              {selectedVideo.aiStatus === "pending" && (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-500/20 border border-slate-200 dark:border-slate-500/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-500/30 rounded-full flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          Ready for AI Analysis
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          Extract labels, detect actions, and score quality
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAnalyze(selectedVideo.id)}
                      disabled={analyzeLoading}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzeLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Analyze
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Processing Section - Show when processing */}
              {selectedVideo.aiStatus === "processing" && (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    <div>
                      <div className="font-medium text-blue-900 dark:text-blue-400">
                        Analysis in Progress
                      </div>
                      <div className="text-sm text-blue-600 dark:text-blue-400">
                        This may take a few moments...
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Failed Section - Show when failed */}
              {selectedVideo.aiStatus === "failed" && (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      <div>
                        <div className="font-medium text-red-900 dark:text-red-400">
                          Analysis Failed
                        </div>
                        <div className="text-sm text-red-600 dark:text-red-400">
                          {selectedVideo.aiError ||
                            "An error occurred during processing"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAnalyze(selectedVideo.id)}
                      disabled={analyzeLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {analyzeLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* AI Analysis Results - Show when completed or reanalyzing */}
              {reanalyzingId === selectedVideo.id ? (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <div className="flex items-center justify-center gap-3 py-8">
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        Re-analyzing video...
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        This may take 1-2 minutes
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedVideo.aiStatus === "completed" ? (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <h3 className="font-medium mb-3 text-gray-900 dark:text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      AI Analysis
                    </span>
                    <button
                      onClick={() => handleReanalyze(selectedVideo.id)}
                      disabled={reanalyzingId === selectedVideo.id}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${reanalyzingId === selectedVideo.id ? "animate-spin" : ""}`}
                      />
                      {reanalyzingId === selectedVideo.id
                        ? "Processing..."
                        : "Re-analyze"}
                    </button>
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-1">
                        Quality Score
                      </div>
                      {renderStars(selectedVideo.aiQualityScore)}
                    </div>
                    <div>
                      <div className="text-gray-500 dark:text-gray-400 mb-1">
                        Room Type
                      </div>
                      <div className="font-medium text-gray-900 dark:text-white capitalize">
                        {selectedVideo.aiRoomType?.replace(/_/g, " ") ||
                          "Unknown"}
                      </div>
                    </div>
                    {selectedVideo.aiActionTypes?.length > 0 && (
                      <div>
                        <div className="text-gray-500 dark:text-gray-400 mb-1">
                          Actions
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white capitalize">
                          {selectedVideo.aiActionTypes.join(", ")}
                        </div>
                      </div>
                    )}
                    {selectedVideo.aiObjectLabels?.length > 0 && (
                      <div className="col-span-2">
                        <div className="text-gray-500 dark:text-gray-400 mb-1 flex items-center justify-between">
                          <span>
                            Objects ({selectedVideo.aiObjectLabels.length})
                          </span>
                          {selectedVideo.aiObjectLabels.length > 8 && (
                            <button
                              onClick={() =>
                                setObjectsExpanded(!objectsExpanded)
                              }
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                            >
                              {objectsExpanded ? "Show less" : "Show all"}
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(objectsExpanded
                            ? selectedVideo.aiObjectLabels
                            : selectedVideo.aiObjectLabels.slice(0, 8)
                          ).map((label, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-500/20 rounded text-xs text-gray-900 dark:text-white"
                            >
                              {label}
                            </span>
                          ))}
                          {!objectsExpanded &&
                            selectedVideo.aiObjectLabels.length > 8 && (
                              <button
                                onClick={() => setObjectsExpanded(true)}
                                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-500/20 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-500/30"
                              >
                                +{selectedVideo.aiObjectLabels.length - 8} more
                              </button>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Training Corpus Section - Show when completed */}
              {selectedVideo.aiStatus === "completed" && (
                <div className="border-t border-gray-200 dark:border-[#1f1f1f] pt-4 mt-4">
                  <h3 className="font-medium mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    Training Corpus
                  </h3>
                  {selectedVideo.trainingStatus === "pending" && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                        Ready for review. Approve to add to training corpus.
                      </div>
                      <button
                        onClick={() =>
                          handleSingleAction(selectedVideo.id, "reject")
                        }
                        disabled={singleActionLoading}
                        className="px-4 py-2 border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-sm"
                      >
                        Reject (R)
                      </button>
                      <button
                        onClick={() =>
                          handleSingleAction(selectedVideo.id, "approve")
                        }
                        disabled={singleActionLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                      >
                        {singleActionLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Approve (A)
                      </button>
                    </div>
                  )}
                  {selectedVideo.trainingStatus === "approved" && (
                    <div className="p-3 bg-green-50 dark:bg-green-500/20 border border-green-200 dark:border-green-500/30 rounded-lg text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Added to training corpus
                    </div>
                  )}
                  {selectedVideo.trainingStatus === "rejected" && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500/30 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Rejected from training corpus
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-[#1f1f1f] pt-3 mt-4">
                Keyboard: ← → navigate • A approve • R reject • Del delete • Esc
                close
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#141414] rounded-xl w-full max-w-lg p-6 space-y-4 border border-gray-200 dark:border-[#1f1f1f]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Videos
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFiles([]);
                  setImportProgress(new Map());
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Import videos directly as admin. Videos will be auto-approved and
              ready for face blurring.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleImportDrop}
              className="border-2 border-dashed border-gray-300 dark:border-[#2a2a2a] rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition cursor-pointer"
              onClick={() =>
                document.getElementById("import-file-input")?.click()
              }
            >
              <input
                id="import-file-input"
                type="file"
                multiple
                accept="video/*"
                onChange={handleImportFiles}
                className="hidden"
              />
              <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
              {importFiles.length === 0 ? (
                <>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">
                    Drop videos here or click to select
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    MP4, MOV, WebM supported
                  </p>
                </>
              ) : (
                <p className="text-blue-600 dark:text-blue-400 font-medium">
                  {importFiles.length} video(s) selected
                </p>
              )}
            </div>

            {/* Selected files list */}
            {importFiles.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-2">
                {importFiles.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm bg-gray-50 dark:bg-[#1a1a1a] rounded-lg px-3 py-2"
                  >
                    <span className="truncate flex-1 text-gray-900 dark:text-white">
                      {file.name}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 ml-2">
                      {formatFileSize(file.size)}
                    </span>
                    {importProgress.get(file.name) !== undefined && (
                      <span className="text-blue-600 dark:text-blue-400 ml-2">
                        {Math.round(importProgress.get(file.name) || 0)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Attribution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Attribution{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={importAttribution}
                onChange={(e) => setImportAttribution(e.target.value)}
                placeholder="Contributor name or leave blank for 'Admin Import'"
                className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#2a2a2a] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFiles([]);
                  setImportProgress(new Map());
                }}
                className="flex-1 px-4 py-2 bg-white dark:bg-[#1f1f1f] border border-gray-300 dark:border-[#2a2a2a] text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importUploading || importFiles.length === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {importFiles.length > 0
                      ? importFiles.length
                      : ""}{" "}
                    Video{importFiles.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Folder Picker */}
      <DriveFolderPicker
        isOpen={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        onSelect={async (folderId, folderName, sourceName) => {
          try {
            const token = await user?.getIdToken();

            // Show listing status
            setDriveImportProgress({
              isImporting: true,
              current: 0,
              total: 0,
              currentFile: "",
              status: "listing",
              message: "Scanning folder for videos...",
            });

            // Step 1: Get the user's Drive access token
            const authCheck = await fetch("/api/admin/drive/check-auth", {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (!authCheck.ok) {
              throw new Error("Drive not connected");
            }

            const { accessToken } = await authCheck.json();

            // Step 2: List video files in the selected folder
            const listResponse = await fetch("/api/admin/drive/list", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                accessToken,
                folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
              }),
            });

            if (!listResponse.ok) {
              const error = await listResponse.json();
              throw new Error(error.error || "Failed to list files");
            }

            const { files } = await listResponse.json();

            if (!files || files.length === 0) {
              setDriveImportProgress(null);
              alert("No video files found in this folder");
              return;
            }

            // Update progress to show importing
            setDriveImportProgress({
              isImporting: true,
              current: 0,
              total: files.length,
              currentFile: files[0]?.name || "",
              status: "importing",
              message: `Importing ${files.length} videos...`,
            });

            // Step 3: Import the files into the media collection
            const importResponse = await fetch("/api/admin/drive/import", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                accessToken,
                files: files.map((f: any) => ({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType,
                  size: f.size,
                })),
                attribution: sourceName,
              }),
            });

            if (!importResponse.ok) {
              const error = await importResponse.json();
              throw new Error(error.error || "Import failed");
            }

            const importData = await importResponse.json();

            // Show completion
            const msg =
              importData.skipCount > 0
                ? `Imported ${importData.successCount} videos, skipped ${importData.skipCount} duplicates`
                : `Imported ${importData.successCount} of ${files.length} videos`;

            setDriveImportProgress({
              isImporting: false,
              current: files.length,
              total: files.length,
              currentFile: "",
              status: "done",
              message: msg,
            });

            // Clear progress after 3 seconds and refresh
            setTimeout(() => {
              setDriveImportProgress(null);
              fetchMedia();
            }, 3000);
          } catch (err: any) {
            console.error("Drive import failed:", err);
            setDriveImportProgress({
              isImporting: false,
              current: 0,
              total: 0,
              currentFile: "",
              status: "error",
              message: "Import failed: " + err.message,
            });

            // Clear error after 5 seconds
            setTimeout(() => setDriveImportProgress(null), 5000);
          }
        }}
      />

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkEditModal(false)}
          onSuccess={() => {
            setShowBulkEditModal(false);
            setSelectedIds(new Set());
            fetchMedia();
          }}
        />
      )}
    </div>
  );
}
