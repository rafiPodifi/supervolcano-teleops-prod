/**
 * Location Media Tab
 * Displays all videos uploaded for a location with blur review workflow
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Calendar,
  User,
  Clock,
  Film,
  X,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BlurReviewTab } from "@/components/admin/media-library/BlurReviewTab";
import type { VideoItem } from "@/app/admin/robot-intelligence/media/page";

interface MediaItem {
  id: string;
  videoUrl: string;
  url?: string;
  storagePath: string;
  type: string;
  locationId: string;
  locationName?: string;
  userId: string;
  organizationId: string;
  fileSize: number;
  size?: number;
  status: string;
  uploadedAt: string;
  recordedAt?: string | null;
  recordingEndedAt?: string | null;
  fileName?: string;
  thumbnailUrl?: string;
  blurStatus?: "none" | "processing" | "complete" | "failed";
  blurredUrl?: string;
  blurApproved?: boolean;
  faceDetectionStatus?: "pending" | "processing" | "completed" | "failed";
  hasFaces?: boolean;
  faceCount?: number;
  aiStatus?: "pending" | "processing" | "completed" | "failed";
  reviewStatus?: "pending" | "approved" | "rejected";
  trainingStatus?: "pending" | "approved" | "rejected";
}

interface LocationMediaTabProps {
  locationId: string;
  locationName?: string;
}

type SubTab = "all" | "blur-review";

export default function LocationMediaTab({
  locationId,
  locationName,
}: LocationMediaTabProps) {
  const { getIdToken } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<MediaItem | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [blurringIds, setBlurringIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getIdToken();
      if (!token) throw new Error("Not authenticated");
      const response = await fetch(`/api/admin/locations/${locationId}/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch media");
      setMedia(data.media || []);
    } catch (err: any) {
      console.error("Error fetching media:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [locationId, getIdToken]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const convertToVideoItem = (item: MediaItem): VideoItem => ({
    id: item.id,
    fileName:
      item.fileName || item.storagePath?.split("/").pop() || "video.mp4",
    url: item.videoUrl || item.url || "",
    thumbnailUrl: item.thumbnailUrl || null,
    locationId: item.locationId,
    locationName: locationName || item.locationName || null,
    uploadedAt: item.uploadedAt,
    recordedAt: item.recordedAt ?? null,
    recordingEndedAt: item.recordingEndedAt ?? null,
    size: item.fileSize || item.size || null,
    duration: null,
    blurStatus: item.blurStatus,
    blurredUrl: item.blurredUrl,
    blurApproved: item.blurApproved,
    faceDetectionStatus: item.faceDetectionStatus,
    hasFaces: item.hasFaces,
    faceCount: item.faceCount,
    aiStatus: item.aiStatus || "pending",
    aiAnnotations: null,
    aiError: null,
    aiRoomType: null,
    aiActionTypes: [],
    aiObjectLabels: [],
    aiQualityScore: null,
    trainingStatus: item.trainingStatus || "pending",
    reviewStatus: item.reviewStatus,
    updatedAt: item.uploadedAt,
  });

  const handleApplyBlur = async (mediaId: string) => {
    try {
      setBlurringIds((prev) => new Set(prev).add(mediaId));
      const token = await getIdToken();
      const response = await fetch("/api/admin/contributions/blur", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mediaId, action: "blur" }),
      });
      const result = await response.json();
      if (result.success) {
        setMedia((prev) =>
          prev.map((m) =>
            m.id === mediaId
              ? {
                  ...m,
                  blurStatus: "complete" as const,
                  blurredUrl: result.blurredUrl,
                }
              : m,
          ),
        );
      } else {
        setMedia((prev) =>
          prev.map((m) =>
            m.id === mediaId ? { ...m, blurStatus: "failed" as const } : m,
          ),
        );
      }
    } catch (error) {
      console.error("Blur failed:", error);
      setMedia((prev) =>
        prev.map((m) =>
          m.id === mediaId ? { ...m, blurStatus: "failed" as const } : m,
        ),
      );
    } finally {
      setBlurringIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  };

  const handleApproveBlur = async (mediaId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(mediaId));
      const token = await getIdToken();
      await fetch(`/api/admin/media/${mediaId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ blurApproved: true }),
      });
      setMedia((prev) =>
        prev.map((m) => (m.id === mediaId ? { ...m, blurApproved: true } : m)),
      );
    } catch (error) {
      console.error("Approve blur failed:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  };

  const handleRejectBlur = async (mediaId: string) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(mediaId));
      const token = await getIdToken();
      await fetch(`/api/admin/media/${mediaId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blurStatus: "none",
          blurApproved: false,
          blurredUrl: null,
        }),
      });
      setMedia((prev) =>
        prev.map((m) =>
          m.id === mediaId
            ? {
                ...m,
                blurStatus: "none" as const,
                blurApproved: false,
                blurredUrl: undefined,
              }
            : m,
        ),
      );
    } catch (error) {
      console.error("Reject blur failed:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids: string[]) => {
    const allSelected = ids.every((id) => selectedIds.has(id));
    if (allSelected)
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    else setSelectedIds((prev) => new Set([...prev, ...ids]));
  };

  const handleVideoClick = (video: VideoItem) => {
    const mediaItem = media.find((m) => m.id === video.id);
    if (mediaItem) setSelectedVideo(mediaItem);
  };

  const formatDate = (dateString: string): string =>
    new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const formatTime = (dateString: string): string =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const formatFileSize = (bytes: number): string =>
    bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : "";

  // Prefer recording wall-clock time over upload time so cards group by when
  // the footage actually happened, matching the dashboard Created column.
  const displayTimestamp = (item: MediaItem): string =>
    item.recordedAt || item.uploadedAt;

  const groupedMedia = media.reduce(
    (groups: Record<string, MediaItem[]>, item) => {
      const date = formatDate(displayTimestamp(item));
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    },
    {},
  );

  const blurReviewCount = media.filter(
    (m) =>
      (m.faceDetectionStatus === "completed" &&
        m.hasFaces &&
        m.blurStatus !== "complete") ||
      (m.blurStatus === "complete" && !m.blurApproved),
  ).length;

  if (loading)
    return (
      <div className="bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    );
  if (error)
    return (
      <div className="bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] p-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
            <Film className="w-6 h-6 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-gray-900 dark:text-white font-medium mb-1">
            Failed to load media
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            {error}
          </p>
          <button
            onClick={fetchMedia}
            className="text-sm text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-500 font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  if (media.length === 0)
    return (
      <div className="bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] p-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#1f1f1f] flex items-center justify-center mb-4">
            <Film className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-900 dark:text-white font-medium mb-1">
            No media yet
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Videos recorded from the mobile app will appear here
          </p>
        </div>
      </div>
    );

  return (
    <>
      <div className="bg-white dark:bg-[#141414] rounded-lg border border-gray-200 dark:border-[#1f1f1f] p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1f1f1f] rounded-lg p-1">
            <button
              onClick={() => setActiveSubTab("all")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeSubTab === "all" ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white shadow-sm dark:shadow-none" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              All Media ({media.length})
            </button>
            <button
              onClick={() => setActiveSubTab("blur-review")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition ${activeSubTab === "blur-review" ? "bg-white dark:bg-[#141414] text-gray-900 dark:text-white shadow-sm dark:shadow-none" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}
            >
              Blur Review {blurReviewCount > 0 && `(${blurReviewCount})`}
            </button>
          </div>
          <button
            onClick={fetchMedia}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {activeSubTab === "all" ? (
          <div className="space-y-8">
            {Object.entries(groupedMedia).map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {date}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {items.map((item) => (
                    <VideoThumbnail
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedVideo(item)}
                      formatTime={formatTime}
                      formatFileSize={formatFileSize}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <BlurReviewTab
            media={media.map(convertToVideoItem)}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onApplyBlur={handleApplyBlur}
            onApproveBlur={handleApproveBlur}
            onRejectBlur={handleRejectBlur}
            blurringIds={blurringIds}
            processingIds={processingIds}
            formatDate={(d) => (d ? formatDate(d) : "—")}
            onVideoClick={handleVideoClick}
          />
        )}
      </div>
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          formatDate={formatDate}
          formatTime={formatTime}
          formatFileSize={formatFileSize}
        />
      )}
    </>
  );
}

function VideoThumbnail({
  item,
  onClick,
  formatTime,
  formatFileSize,
}: {
  item: MediaItem;
  onClick: () => void;
  formatTime: (date: string) => string;
  formatFileSize: (bytes: number) => string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-video bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-orange-500 transition-all"
    >
      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-5 h-5 text-gray-900 ml-1" fill="currentColor" />
        </div>
      </div>
      {item.blurStatus === "complete" && (
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${item.blurApproved ? "bg-green-500 text-white" : "bg-amber-500 text-white"}`}
          >
            {item.blurApproved ? "✓ Blurred" : "Review"}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-white text-xs font-medium">
          {formatTime(item.recordedAt || item.uploadedAt)}
        </p>
        {item.fileSize && (
          <p className="text-white/70 text-xs">
            {formatFileSize(item.fileSize)}
          </p>
        )}
      </div>
    </button>
  );
}

function VideoModal({
  video,
  onClose,
  formatDate,
  formatTime,
  formatFileSize,
}: {
  video: MediaItem;
  onClose: () => void;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  formatFileSize: (bytes: number) => string;
}) {
  const [showBlurred, setShowBlurred] = useState(true);
  const hasBlurredVersion = video.blurStatus === "complete" && video.blurredUrl;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-[#141414] rounded-xl overflow-hidden shadow-2xl dark:shadow-none">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#1f1f1f]">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDate(video.recordedAt || video.uploadedAt)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatTime(video.recordedAt || video.uploadedAt)}
              {video.fileSize && ` • ${formatFileSize(video.fileSize)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasBlurredVersion && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1f1f1f] rounded-lg p-1 mr-2">
                <button
                  onClick={() => setShowBlurred(false)}
                  className={`px-3 py-1 text-xs font-medium rounded transition ${!showBlurred ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900" : "text-gray-600 dark:text-gray-400"}`}
                >
                  Original
                </button>
                <button
                  onClick={() => setShowBlurred(true)}
                  className={`px-3 py-1 text-xs font-medium rounded transition ${showBlurred ? "bg-orange-500 text-white" : "text-gray-600 dark:text-gray-400"}`}
                >
                  Blurred
                </button>
              </div>
            )}
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="aspect-video bg-black">
          <video
            key={showBlurred && hasBlurredVersion ? "blurred" : "original"}
            src={
              showBlurred && hasBlurredVersion
                ? video.blurredUrl
                : video.videoUrl
            }
            controls
            autoPlay
            className="w-full h-full"
          />
        </div>
        <div className="p-4 bg-gray-50 dark:bg-[#1f1f1f] border-t border-gray-200 dark:border-[#2a2a2a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                <span>{video.userId.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Uploaded {formatTime(video.uploadedAt)}</span>
              </div>
            </div>
            {hasBlurredVersion && (
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${video.blurApproved ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400"}`}
              >
                {video.blurApproved ? "Blur Approved" : "Pending Review"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
