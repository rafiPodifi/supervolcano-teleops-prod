"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  createProperty,
  updateProperty,
} from "@/lib/repositories/propertiesRepo";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  FilePlus2,
  Layers,
  MapPin,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { TaskForm, type TaskFormData } from "@/components/TaskForm";
import type { PortalTask } from "@/components/TaskList";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useCollection } from "@/hooks/useCollection";
import { useTaskTemplates } from "@/hooks/useTaskTemplates";
import { useProperties } from "@/hooks/useProperties";
import { useSaveTask } from "@/hooks/useSaveTask";
import { firestore, storage } from "@/lib/firebaseClient";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { incrementTemplateAssignment } from "@/lib/templates";
import type {
  PropertyMediaItem,
  PropertyStatus,
  SVProperty,
} from "@/lib/types";

const DETAIL_TABS = ["summary", "media", "tasks"] as const;
const FORM_STEPS = ["Basics", "Details", "Media"] as const;

type DetailTab = (typeof DETAIL_TABS)[number];
type FormStep = (typeof FORM_STEPS)[number];

type AdminProperty = SVProperty;

type PropertyFormState = {
  name: string;
  address: string;
  partnerOrgId: string;
  status: PropertyStatus;
  description: string;
  existingMedia: PropertyMediaItem[];
  removedMediaIds: string[];
  uploadFiles: File[];
  isActive: boolean;
};

function normalizeStatus(value: unknown): PropertyStatus {
  if (typeof value !== "string") return "unassigned";
  return value.toLowerCase() === "scheduled" ? "scheduled" : "unassigned";
}

function buildEmptyForm(defaultPartnerOrg?: string): PropertyFormState {
  return {
    name: "",
    address: "",
    partnerOrgId: defaultPartnerOrg ?? "demo-org",
    status: "unassigned",
    description: "",
    existingMedia: [],
    removedMediaIds: [],
    uploadFiles: [],
    isActive: true,
  };
}

function mapPropertyMediaForForm(
  property?: AdminProperty | null,
): PropertyMediaItem[] {
  if (!property) return [];
  if (Array.isArray(property.media) && property.media.length) {
    return property.media.map((item) => ({
      ...item,
      id: item.id || item.url,
    }));
  }
  if (Array.isArray(property.images) && property.images.length) {
    return property.images.map((url) => ({
      id: url,
      url,
      type: "image" as const,
    }));
  }
  return [];
}

function createMediaId(fallback: string) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${fallback}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferMediaType(file: File): PropertyMediaItem["type"] {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (
    extension &&
    ["mp4", "mov", "m4v", "webm", "avi", "mkv"].includes(extension)
  ) {
    return "video";
  }
  return "image";
}

export default function AdminPropertiesPage() {
  const router = useRouter();
  const { user, claims, loading: authLoading } = useAuth();

  const role = (claims?.role as string | undefined) ?? "operator";
  const partnerOrgClaim =
    typeof claims?.partner_org_id === "string"
      ? (claims.partner_org_id as string)
      : undefined;
  const isAdmin = role === "admin";

  const {
    properties,
    loading: propertiesLoading,
    error: propertiesError,
  } = useProperties({ enabled: isAdmin, includeInactive: true });

  const [searchValue, setSearchValue] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>("summary");

  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(true);
  const [propertyFormState, setPropertyFormState] = useState<PropertyFormState>(
    () => buildEmptyForm(partnerOrgClaim),
  );
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(
    null,
  );
  const [propertyFormStepIndex, setPropertyFormStepIndex] = useState(0);
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  const {
    create: createTaskMutation,
    update: updateTaskMutation,
    remove: deleteTaskMutation,
    loading: taskMutationLoading,
  } = useSaveTask();

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PortalTask | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Use a ref to store previous properties array to prevent unnecessary recalculations
  const propertiesRef = useRef(properties);
  const selectedPropertyIdRef = useRef(selectedPropertyId);

  // Only update refs when actual values change (not just reference)
  useEffect(() => {
    const propsChanged =
      properties.length !== propertiesRef.current.length ||
      properties.some((p, i) => p.id !== propertiesRef.current[i]?.id);
    if (propsChanged) {
      propertiesRef.current = properties;
    }
    if (selectedPropertyId !== selectedPropertyIdRef.current) {
      selectedPropertyIdRef.current = selectedPropertyId;
    }
  }, [properties, selectedPropertyId]);

  const selectedProperty = useMemo(() => {
    if (!selectedPropertyId) return null;
    // Use stable reference to properties array
    return (
      propertiesRef.current.find((item) => item.id === selectedPropertyId) ??
      null
    );
  }, [selectedPropertyId]); // Only depend on selectedPropertyId, not properties array

  const editingProperty = useMemo(() => {
    if (!editingPropertyId) return null;
    return properties.find((item) => item.id === editingPropertyId) ?? null;
  }, [properties, editingPropertyId]);

  const { activeTemplates } = useTaskTemplates();

  const {
    data: tasks,
    loading: tasksLoading,
    error: tasksError,
  } = useCollection<PortalTask>({
    path: "tasks",
    enabled: Boolean(selectedPropertyId),
    whereEqual: selectedPropertyId
      ? [{ field: "locationId", value: selectedPropertyId }]
      : undefined,
    parse: (doc) =>
      ({
        id: doc.id,
        name: doc.name ?? doc.title ?? "Untitled task",
        locationId: doc.locationId ?? doc.propertyId,
        status: doc.status ?? doc.state ?? "scheduled",
        assignment: doc.assigned_to ?? "oem_teleoperator",
        duration: doc.duration ?? undefined,
        priority: doc.priority ?? undefined,
        assignedToUserId: doc.assignedToUserId ?? doc.assigneeId ?? null,
        updatedAt: doc.updatedAt ?? undefined,
        templateId: doc.templateId ?? undefined,
      }) as PortalTask,
  });

  const filteredProperties = useMemo(() => {
    if (!searchValue.trim()) return properties;
    const queryText = searchValue.trim().toLowerCase();
    return properties.filter((property) =>
      [property.name, property.partnerOrgId, property.address]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(queryText)),
    );
  }, [properties, searchValue]);

  const operatorTaskCount = useMemo(() => {
    return tasks.filter((task) => task.assignment === "oem_teleoperator")
      .length;
  }, [tasks]);

  const resetPropertyForm = useCallback(() => {
    setPropertyFormState(buildEmptyForm(partnerOrgClaim));
    setPropertyFormStepIndex(0);
    setPropertyError(null);
    setEditingPropertyId(null);
  }, [partnerOrgClaim]);

  const openCreatePropertyDrawer = useCallback(() => {
    resetPropertyForm();
    setPropertyDrawerOpen(true);
  }, [resetPropertyForm]);

  const openEditPropertyDrawer = useCallback((property: AdminProperty) => {
    setPropertyFormState({
      name: property.name,
      address: property.address ?? "",
      partnerOrgId: property.partnerOrgId,
      status: property.status,
      description: property.description ?? "",
      existingMedia: mapPropertyMediaForForm(property),
      removedMediaIds: [],
      uploadFiles: [],
      isActive: property.isActive !== false,
    });
    setPropertyFormStepIndex(0);
    setPropertyError(null);
    setEditingPropertyId(property.id);
    setPropertyDrawerOpen(true);
  }, []);

  const closePropertyDrawer = useCallback(() => {
    setPropertyDrawerOpen(false);
    setTimeout(() => {
      resetPropertyForm();
    }, 250);
  }, [resetPropertyForm]);

  const nextFormStep = useCallback(() => {
    setPropertyFormStepIndex((index) =>
      Math.min(index + 1, FORM_STEPS.length - 1),
    );
  }, []);

  const previousFormStep = useCallback(() => {
    setPropertyFormStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  async function persistProperty() {
    console.log("=".repeat(80));
    console.log("[admin] persistProperty: CALLED", {
      hasUser: !!user,
      userId: user?.uid,
      userEmail: user?.email,
      propertySaving,
      editingPropertyId,
      formState: {
        name: propertyFormState.name,
        nameLength: propertyFormState.name?.length,
        partnerOrgId: propertyFormState.partnerOrgId,
        address: propertyFormState.address,
      },
      timestamp: new Date().toISOString(),
    });
    console.log("=".repeat(80));

    if (!user) {
      console.error("[admin] ❌ persistProperty: no user");
      toast.error("You must be logged in to save properties");
      return;
    }

    // Validate required fields
    const trimmedName = propertyFormState.name?.trim() || "";
    if (!trimmedName) {
      console.error("[admin] ❌ persistProperty: name is required", {
        name: propertyFormState.name,
        nameType: typeof propertyFormState.name,
        nameLength: propertyFormState.name?.length,
      });
      toast.error("Property name is required");
      setPropertyError("Property name is required");
      return;
    }
    console.log("[admin] ✅ persistProperty: name validated", {
      trimmedName,
      length: trimmedName.length,
    });

    const trimmedPartnerOrg =
      propertyFormState.partnerOrgId.trim() || partnerOrgClaim || "demo-org";

    setPropertySaving(true);
    setPropertyError(null);

    try {
      console.time("persistProperty");
      console.log("[admin] persistProperty:start", {
        editingPropertyId,
        trimmedPartnerOrg,
        userId: user.uid,
        userEmail: user.email,
        role,
        isAdmin,
      });
      // Force refresh token to get latest claims (especially after role changes)
      // This ensures the Firestore SDK uses a token with the latest admin role claim
      console.log("[admin] Refreshing token to get latest claims...");
      try {
        const token = await user.getIdToken(true); // Force refresh
        if (token) {
          // Decode token to check claims (just for debugging - don't use in production)
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            const tokenRole = payload.role;
            console.log("[admin] persistProperty:token claims", {
              role: tokenRole,
              partner_org_id: payload.partner_org_id,
              email: payload.email,
              uid: payload.user_id || payload.sub,
            });

            if (tokenRole !== "admin") {
              console.error(
                "[admin] ❌ CRITICAL: Token does not have admin role!",
                {
                  tokenRole: tokenRole,
                  expectedRole: "admin",
                  hasRole: !!tokenRole,
                  roleType: typeof tokenRole,
                },
              );
              const errorMsg = `Permission denied: Your account role is "${tokenRole || "undefined"}" but "admin" is required. Please sign out and sign back in to refresh your token, or contact an administrator.`;
              toast.error(errorMsg);
              setPropertySaving(false);
              setPropertyError(errorMsg);
              return;
            } else {
              console.log(
                "[admin] ✅ Token has admin role - proceeding with save",
              );
            }
          } catch (decodeError) {
            // Token decode failed - log but continue (Firestore will validate)
            console.warn(
              "[admin] Could not decode token claims (continuing anyway)",
              decodeError,
            );
          }
        }
        console.log("[admin] persistProperty:token refreshed and validated");
      } catch (tokenError) {
        console.error("[admin] token refresh failed", tokenError);
        const errorMsg =
          "Failed to refresh authentication token. Please try again.";
        toast.error(errorMsg);
        setPropertySaving(false);
        setPropertyError(errorMsg);
        return;
      }

      const removedMediaItems = propertyFormState.existingMedia.filter((item) =>
        propertyFormState.removedMediaIds.includes(item.id),
      );
      if (removedMediaItems.length) {
        console.log(
          "[admin] persistProperty:removing media",
          removedMediaItems.map((item) => item.id),
        );
        await Promise.all(
          removedMediaItems.map(async (item) => {
            try {
              if (item.storagePath) {
                await deleteObject(ref(storage, item.storagePath));
                return;
              }
              const parsed = new URL(item.url);
              const objectRef = ref(
                storage,
                decodeURIComponent(parsed.pathname.replace(/^\//, "")),
              );
              await deleteObject(objectRef);
            } catch (error) {
              console.warn("[admin] failed to remove media", item.url, error);
            }
          }),
        );
      }

      const retainedMedia = propertyFormState.existingMedia.filter(
        (item) => !propertyFormState.removedMediaIds.includes(item.id),
      );

      let propertyId: string;
      const uploadedMediaItems: PropertyMediaItem[] = [];

      if (editingProperty && editingPropertyId) {
        // Update existing document
        propertyId = editingPropertyId;

        // Upload new media files
        for (const file of propertyFormState.uploadFiles) {
          console.log("[admin] persistProperty:upload", file.name, file.size);
          const type = inferMediaType(file);
          const mediaId = createMediaId(file.name);
          const path = `locations/${propertyId}/media/${mediaId}-${file.name}`;
          const storageRef = ref(storage, path);
          const snapshot = await uploadBytes(storageRef, file, {
            contentType: file.type,
          });
          const url = await getDownloadURL(snapshot.ref);
          uploadedMediaItems.push({
            id: mediaId,
            url,
            type,
            storagePath: snapshot.ref.fullPath ?? path,
            contentType: snapshot.metadata.contentType ?? file.type,
            createdAt: new Date(),
          });
        }

        const media = [...retainedMedia, ...uploadedMediaItems];
        const images = media
          .filter((item) => item.type === "image")
          .map((item) => item.url);
        const videoCount = media.filter((item) => item.type === "video").length;

        // Update using repository function
        await updateProperty(
          propertyId,
          {
            name: propertyFormState.name.trim(),
            address: propertyFormState.address.trim(),
            partnerOrgId: trimmedPartnerOrg,
            status: propertyFormState.status,
            description: propertyFormState.description.trim(),
            images,
            media,
            imageCount: images.length,
            videoCount,
            isActive: propertyFormState.isActive,
          },
          user.uid,
        );

        console.log("[admin] Location updated:", propertyId);
      } else {
        // Create new document FIRST to get proper Firestore UUID
        const nameToSave = trimmedName; // Use validated trimmed name
        const addressToSave = propertyFormState.address.trim();

        console.log("[admin] Creating new location...", {
          name: nameToSave,
          nameLength: nameToSave.length,
          address: addressToSave,
          partnerOrgId: trimmedPartnerOrg,
          createdBy: user.uid,
          fullFormState: propertyFormState,
        });

        try {
          propertyId = await createProperty({
            name: nameToSave,
            address: addressToSave,
            partnerOrgId: trimmedPartnerOrg,
            status: propertyFormState.status,
            description: propertyFormState.description.trim(),
            images: [],
            media: [],
            createdBy: user.uid,
          });
          console.log(
            "[admin] Location created with Firestore UUID:",
            propertyId,
          );
        } catch (createError) {
          console.error("[admin] Failed to create location:", createError);
          throw new Error(
            `Failed to create location: ${createError instanceof Error ? createError.message : String(createError)}`,
          );
        }

        // Now upload media files using the proper UUID
        for (const file of propertyFormState.uploadFiles) {
          console.log("[admin] persistProperty:upload", file.name, file.size);
          const type = inferMediaType(file);
          const mediaId = createMediaId(file.name);
          const path = `locations/${propertyId}/media/${mediaId}-${file.name}`;
          const storageRef = ref(storage, path);
          const snapshot = await uploadBytes(storageRef, file, {
            contentType: file.type,
          });
          const url = await getDownloadURL(snapshot.ref);
          uploadedMediaItems.push({
            id: mediaId,
            url,
            type,
            storagePath: snapshot.ref.fullPath ?? path,
            contentType: snapshot.metadata.contentType ?? file.type,
            createdAt: new Date(),
          });
        }

        // Update document with media URLs
        const media = [...retainedMedia, ...uploadedMediaItems];
        const images = media
          .filter((item) => item.type === "image")
          .map((item) => item.url);
        const videoCount = media.filter((item) => item.type === "video").length;

        if (uploadedMediaItems.length > 0 || retainedMedia.length > 0) {
          console.log("[admin] Updating location with media...", {
            propertyId,
            mediaCount: media.length,
            imageCount: images.length,
            videoCount,
          });
          try {
            await updateProperty(
              propertyId,
              {
                images,
                media,
                imageCount: images.length,
                videoCount,
              },
              user.uid,
            );
            console.log("[admin] Location media updated:", propertyId);
          } catch (updateError) {
            console.error(
              "[admin] Failed to update location media:",
              updateError,
            );
            // Don't throw - the location was created successfully, media update can fail
            toast(
              "Location created but media upload failed. You can add media later.",
              { icon: "⚠️" },
            );
          }
        }
      }

      console.info("[admin] property saved", propertyId);
      setSelectedPropertyId(propertyId);
      closePropertyDrawer();
      toast.success(editingProperty ? "Property updated" : "Property created");
    } catch (error) {
      console.error("=".repeat(80));
      console.error("[admin] ❌❌❌ persistProperty: ERROR CAUGHT ❌❌❌");
      console.error("[admin] persistProperty:error", error);
      console.error("[admin] persistProperty:error details", {
        error,
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorCode: (error as any)?.code,
        errorName: (error as any)?.name,
      });
      console.error("=".repeat(80));

      const message =
        error instanceof Error
          ? error.message
          : "Unable to save property. Verify your admin access.";
      setPropertyError(message);

      // Show a more visible error
      toast.error(`Failed to save: ${message}`, {
        duration: 10000, // Show for 10 seconds
      });

      // Also log to console with instructions
      console.error("\n🔍 TROUBLESHOOTING:");
      console.error(
        "1. Check Network tab for requests to firestore.googleapis.com",
      );
      console.error(
        "2. Check if request was sent (status: pending/200/403/401)",
      );
      console.error("3. If no request appears, the SDK isn't sending it");
      console.error("4. If 403, check Firestore rules and admin role");
      console.error("5. If 401, sign out and sign back in");
    } finally {
      setPropertySaving(false);
      console.log("[admin] persistProperty:end");
      console.timeEnd("persistProperty");
    }
  }

  async function handleDeleteProperty(property: AdminProperty) {
    try {
      const propertyRef = doc(firestore, "locations", property.id);
      const tasksQuery = query(
        collection(firestore, "tasks"),
        where("locationId", "==", property.id),
      );
      const snapshot = await getDocs(tasksQuery);

      await Promise.all(
        snapshot.docs.map((taskDoc) =>
          deleteDoc(doc(firestore, "tasks", taskDoc.id)),
        ),
      );
      await deleteDoc(propertyRef);

      if (selectedPropertyId === property.id) {
        setSelectedPropertyId(null);
      }
      toast.success("Property deleted");
    } catch (error) {
      console.error("[admin] failed to delete property", error);
      const message =
        error instanceof Error ? error.message : "Unable to delete property.";
      toast.error(message);
    }
  }

  async function handleTogglePropertyStatus(
    property: AdminProperty,
    checked: boolean,
  ) {
    const nextStatus: PropertyStatus = checked ? "scheduled" : "unassigned";
    await updateDoc(doc(firestore, "locations", property.id), {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    toast.success(
      `Property "${property.name}" marked ${nextStatus === "scheduled" ? "scheduled" : "unassigned"}.`,
    );
  }

  const taskFormInitialValues = useMemo<
    Partial<TaskFormData> | undefined
  >(() => {
    if (!editingTask) return undefined;
    return {
      name: editingTask.name,
      assignment: editingTask.assignment,
      duration: editingTask.duration ?? undefined,
      priority: editingTask.priority ?? undefined,
      status: editingTask.status,
      templateId: editingTask.templateId ?? undefined,
    };
  }, [editingTask]);

  function openTaskDrawer(task?: PortalTask) {
    setEditingTask(task ?? null);
    setTaskFormOpen(true);
  }

  async function saveTask(form: TaskFormData) {
    if (!selectedProperty || !user) return;

    try {
      if (editingTask) {
        await updateTaskMutation({
          id: editingTask.id,
          name: form.name,
          assignment: form.assignment,
          duration: form.duration ?? null,
          priority: form.priority ?? null,
          templateId: form.templateId ?? null,
          status: form.status,
        });

        if (form.templateId && form.assignment !== editingTask.assignment) {
          await incrementTemplateAssignment(form.templateId, form.assignment);
        }

        toast.success("Task updated");
      } else {
        const taskId = await createTaskMutation({
          locationId: selectedProperty.id,
          partnerOrgId: selectedProperty.partnerOrgId,
          name: form.name,
          assignment: form.assignment,
          duration: form.duration ?? null,
          priority: form.priority ?? null,
          templateId: form.templateId ?? null,
          status: form.status,
          createdBy: user.uid,
        });

        await updateDoc(doc(firestore, "locations", selectedProperty.id), {
          taskCount: increment(1),
        });

        await incrementTemplateAssignment(form.templateId, form.assignment);
        console.info("[admin] task created", taskId);
        toast.success("Task added");
      }
    } catch (error) {
      console.error("[admin] failed to save task", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save task. Check your admin access.";
      toast.error(message);
      return;
    } finally {
      setTaskFormOpen(false);
      setEditingTask(null);
    }
  }

  async function deleteTask(task: PortalTask) {
    if (!selectedProperty) return;

    setDeletingTaskId(task.id);
    try {
      await deleteTaskMutation(task.id);
      await updateDoc(doc(firestore, "locations", selectedProperty.id), {
        taskCount: increment(-1),
      });
      toast.success("Task deleted");
    } catch (error) {
      console.error("[admin] failed to delete task", error);
      const message =
        error instanceof Error ? error.message : "Unable to delete task.";
      toast.error(message);
    } finally {
      setDeletingTaskId(null);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-500">Loading your account…</p>
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Card className="w-full max-w-md border-neutral-200">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">
              Admin access required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-500">
            <p>This area is reserved for administrators.</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/properties" prefetch={false}>
                Go back to operator portal
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-neutral-400">
          Admin / Properties
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">Properties</h1>
        <p className="text-sm text-neutral-500">
          Manage property details, media, and template-driven tasks.
        </p>
      </header>
      <section className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm lg:sticky lg:top-10 lg:h-[75vh] lg:flex-shrink-0 lg:overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                Properties
              </h2>
              <p className="text-xs text-neutral-500">
                Select a property to manage details
              </p>
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={openCreatePropertyDrawer}
              aria-label="Create property"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by name or partner…"
                className="pl-9"
              />
            </label>
          </div>
          <div className="mt-4 h-[calc(100%-128px)] overflow-y-auto pr-1">
            {propertiesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl bg-neutral-100"
                  />
                ))}
              </div>
            ) : filteredProperties.length ? (
              <ul className="space-y-2">
                {filteredProperties.map((property) => {
                  const isActive = selectedPropertyId === property.id;
                  return (
                    <li key={property.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                          setActiveTab("summary");
                        }}
                        className={cn(
                          "w-full rounded-xl border border-neutral-200 px-4 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50",
                          isActive &&
                            "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-900",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {property.name}
                          </span>
                          <Badge
                            variant={
                              property.status === "scheduled"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {property.status === "scheduled"
                              ? "Scheduled"
                              : "Unassigned"}
                          </Badge>
                        </div>
                        <p
                          className={cn(
                            "mt-1 text-xs",
                            isActive ? "text-neutral-200" : "text-neutral-500",
                          )}
                        >
                          {property.partnerOrgId}
                        </p>
                        {property.address ? (
                          <p
                            className={cn(
                              "mt-1 line-clamp-1 text-xs",
                              isActive
                                ? "text-neutral-200"
                                : "text-neutral-400",
                            )}
                          >
                            {property.address}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-6 space-y-3 text-sm text-neutral-500">
                {propertiesError ? (
                  <p>{propertiesError}</p>
                ) : (
                  <p>No properties found.</p>
                )}
                <Button
                  variant="outline"
                  onClick={openCreatePropertyDrawer}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create property
                </Button>
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 space-y-6">
          {selectedProperty ? (
            <div className="space-y-6">
              <header className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">
                      {selectedProperty.name}
                    </h1>
                    <p className="flex items-center gap-2 text-sm text-neutral-500">
                      <Layers className="h-4 w-4" />{" "}
                      {selectedProperty.partnerOrgId}
                    </p>
                    {selectedProperty.address && (
                      <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
                        <MapPin className="h-4 w-4" />{" "}
                        {selectedProperty.address}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        selectedProperty.status === "scheduled"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {selectedProperty.status === "scheduled"
                        ? "Scheduled"
                        : "Unassigned"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleTogglePropertyStatus(
                          selectedProperty,
                          selectedProperty.status !== "scheduled",
                        )
                      }
                    >
                      {selectedProperty.status === "scheduled"
                        ? "Mark unassigned"
                        : "Mark scheduled"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditPropertyDrawer(selectedProperty)}
                    >
                      <Edit3 className="mr-2 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openTaskDrawer()}
                    >
                      <FilePlus2 className="mr-2 h-4 w-4" /> Add task
                    </Button>
                    {selectedPropertyId && (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/property/${selectedPropertyId}`}
                          prefetch={false}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" /> Open
                          property page
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs uppercase text-neutral-500">
                      Teleoperator tasks
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-neutral-900">
                      {operatorTaskCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs uppercase text-neutral-500">
                      Total tasks
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-neutral-900">
                      {tasks.length}
                    </p>
                  </div>
                  <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                    <p className="text-xs uppercase text-neutral-500">
                      Last updated
                    </p>
                    <p className="mt-1 text-sm text-neutral-700">
                      {selectedProperty.updatedAt
                        ? formatDateTime(selectedProperty.updatedAt)
                        : "Not yet updated"}
                    </p>
                  </div>
                </div>
              </header>

              <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-6 py-3">
                  <div className="flex items-center gap-2">
                    {DETAIL_TABS.map((tab) => (
                      <Button
                        key={tab}
                        variant={activeTab === tab ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === "summary" && "Summary"}
                        {tab === "media" && "Media"}
                        {tab === "tasks" && "Tasks"}
                      </Button>
                    ))}
                  </div>
                  {activeTab === "tasks" ? (
                    <Button size="sm" onClick={() => openTaskDrawer()}>
                      <Plus className="mr-2 h-4 w-4" /> New task
                    </Button>
                  ) : null}
                </div>

                <div className="px-6 py-5">
                  {activeTab === "summary" ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-800">
                          Overview
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                          {selectedProperty.description ||
                            "No description provided yet."}
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-neutral-200">
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold text-neutral-700">
                              Partner organisation
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm text-neutral-600">
                            {selectedProperty.partnerOrgId}
                          </CardContent>
                        </Card>
                        <Card className="border-neutral-200">
                          <CardHeader>
                            <CardTitle className="text-sm font-semibold text-neutral-700">
                              Address
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-sm text-neutral-600">
                            {selectedProperty.address ||
                              "Add an address to help operators navigate."}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === "media" ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-neutral-800">
                            Media library
                          </h3>
                          <p className="text-xs text-neutral-500">
                            Upload reference photos or floor plans for
                            operators.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openEditPropertyDrawer(selectedProperty)
                          }
                        >
                          <UploadCloud className="mr-2 h-4 w-4" /> Manage media
                        </Button>
                      </div>
                      {selectedProperty.media.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {selectedProperty.media.map((item) => (
                            <div
                              key={item.id}
                              className="relative h-40 w-full overflow-hidden rounded-xl border border-neutral-200"
                            >
                              {item.type === "image" ? (
                                <Image
                                  src={item.url}
                                  alt={selectedProperty.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <video
                                  src={item.url}
                                  className="h-full w-full object-cover"
                                  controls
                                  playsInline
                                />
                              )}
                              <span className="absolute right-3 top-3 rounded-full bg-neutral-900/70 px-2 py-1 text-xs font-medium uppercase tracking-wide text-white">
                                {item.type === "image" ? "Image" : "Video"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                          No media uploaded yet. Add imagery or walkthrough
                          videos so operators know what to expect on site.
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === "tasks" ? (
                    <div className="space-y-4">
                      {tasksError ? (
                        <p className="text-sm text-red-600">{tasksError}</p>
                      ) : null}
                      {tasksLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 4 }).map((_, index) => (
                            <div
                              key={index}
                              className="h-16 animate-pulse rounded-xl bg-neutral-100"
                            />
                          ))}
                        </div>
                      ) : tasks.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Assignment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Duration</TableHead>
                              <TableHead>Priority</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tasks.map((task) => (
                              <TableRow key={task.id}>
                                <TableCell className="font-medium">
                                  {task.name}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      task.assignment === "oem_teleoperator"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {task.assignment === "oem_teleoperator"
                                      ? "Teleoperator"
                                      : "Human"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{task.status}</TableCell>
                                <TableCell>
                                  {task.duration ? `${task.duration} min` : "—"}
                                </TableCell>
                                <TableCell>{task.priority ?? "—"}</TableCell>
                                <TableCell className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openTaskDrawer(task)}
                                  >
                                    Edit
                                  </Button>
                                  <ConfirmDialog
                                    title="Delete task"
                                    description="This removes the task from the property."
                                    confirmLabel="Delete"
                                    destructive
                                    onConfirm={() => deleteTask(task)}
                                  >
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={deletingTaskId === task.id}
                                    >
                                      Delete
                                    </Button>
                                  </ConfirmDialog>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
                          No tasks yet. Create a task to assign work to your
                          operators.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/properties")}
                className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900"
              >
                <ArrowLeft className="h-4 w-4" /> Go to operator view
              </Button>
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-neutral-200 bg-white p-12 text-center text-neutral-500 shadow-sm">
              <div className="rounded-full bg-neutral-100 p-3">
                <Layers className="h-6 w-6 text-neutral-400" />
              </div>
              <div className="max-w-sm space-y-2">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Choose a property to get started
                </h2>
                <p className="text-sm text-neutral-500">
                  Browse the list on the left or create a new property to begin
                  managing tasks and media.
                </p>
              </div>
              <Button onClick={openCreatePropertyDrawer}>
                <Plus className="mr-2 h-4 w-4" /> Create property
              </Button>
            </div>
          )}
        </section>
      </section>

      <Sheet
        open={propertyDrawerOpen}
        onOpenChange={(open) =>
          open ? setPropertyDrawerOpen(true) : closePropertyDrawer()
        }
      >
        <SheetContent className="w-full max-w-xl border-l border-neutral-200">
          <div className="flex h-full flex-col pt-16">
            <div className="flex-1 overflow-y-auto px-6">
              <SheetHeader>
                <SheetTitle>
                  {editingProperty ? "Edit property" : "Create property"}
                </SheetTitle>
                <SheetDescription>
                  {editingProperty
                    ? `Update core details, media, and tasks for ${editingProperty.name}.`
                    : "Define a new property for teleoperators and human cleaners."}
                </SheetDescription>
              </SheetHeader>

              {propertyError ? (
                <p className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {propertyError}
                </p>
              ) : null}

              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
                  <span>
                    Step {propertyFormStepIndex + 1} of {FORM_STEPS.length}
                  </span>
                  <span>{FORM_STEPS[propertyFormStepIndex]}</span>
                </div>
                <div className="h-1 w-full rounded-full bg-neutral-200">
                  <div
                    className="h-full rounded-full bg-neutral-900 transition-all"
                    style={{
                      width: `${((propertyFormStepIndex + 1) / FORM_STEPS.length) * 100}%`,
                    }}
                  />
                </div>

                {propertyError && (
                  <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {propertyError}
                  </p>
                )}

                {propertyFormStepIndex === 0 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="property-name">Property name</Label>
                      <Input
                        id="property-name"
                        value={propertyFormState.name}
                        onChange={(event) =>
                          setPropertyFormState((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="Skyline Tower, Level 4"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-partner">
                        Partner organisation
                      </Label>
                      <Input
                        id="property-partner"
                        value={propertyFormState.partnerOrgId}
                        onChange={(event) =>
                          setPropertyFormState((prev) => ({
                            ...prev,
                            partnerOrgId: event.target.value,
                          }))
                        }
                        placeholder="demo-org"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-address">Address</Label>
                      <Input
                        id="property-address"
                        value={propertyFormState.address}
                        onChange={(event) =>
                          setPropertyFormState((prev) => ({
                            ...prev,
                            address: event.target.value,
                          }))
                        }
                        placeholder="123 Market Street, San Francisco"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="property-status">Status</Label>
                      <select
                        id="property-status"
                        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                        value={propertyFormState.status}
                        onChange={(event) =>
                          setPropertyFormState((prev) => ({
                            ...prev,
                            status: event.target.value as PropertyStatus,
                          }))
                        }
                      >
                        <option value="scheduled">Scheduled</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {propertyFormStepIndex === 1 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="property-description">Description</Label>
                      <textarea
                        id="property-description"
                        rows={5}
                        className="flex w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                        placeholder="Share a short briefing for operators…"
                        value={propertyFormState.description}
                        onChange={(event) =>
                          setPropertyFormState((prev) => ({
                            ...prev,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
                      Tip: include access instructions, preferred contact
                      details, or links to standard operating procedures.
                    </div>
                  </div>
                ) : null}

                {propertyFormStepIndex === 2 ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="property-media">Upload media</Label>
                      <Input
                        id="property-media"
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={(event) => {
                          const files = event.target.files;
                          if (!files) return;
                          setPropertyFormState((prev) => ({
                            ...prev,
                            uploadFiles: [
                              ...prev.uploadFiles,
                              ...Array.from(files),
                            ],
                          }));
                        }}
                      />
                      <p className="text-xs text-neutral-500">
                        Upload reference photos (JPG, PNG, HEIC) or short video
                        walkthroughs (MP4, MOV).
                      </p>
                    </div>
                    {propertyFormState.existingMedia.length ? (
                      <div>
                        <p className="text-xs font-medium text-neutral-500">
                          Existing media
                        </p>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          {propertyFormState.existingMedia.map((item) => {
                            const markedForRemoval =
                              propertyFormState.removedMediaIds.includes(
                                item.id,
                              );
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "relative h-32 w-full overflow-hidden rounded-lg border border-neutral-200",
                                  markedForRemoval && "border-red-300",
                                )}
                              >
                                {item.type === "image" ? (
                                  <Image
                                    src={item.url}
                                    alt="Property media"
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <video
                                    src={item.url}
                                    className="h-full w-full object-cover"
                                    controls
                                    playsInline
                                  />
                                )}
                                <div className="absolute left-2 top-2 flex items-center gap-2">
                                  <Badge
                                    variant={
                                      item.type === "image"
                                        ? "secondary"
                                        : "default"
                                    }
                                    className="uppercase"
                                  >
                                    {item.type === "image" ? "Image" : "Video"}
                                  </Badge>
                                  {markedForRemoval ? (
                                    <span className="rounded bg-red-500/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                      Removing
                                    </span>
                                  ) : null}
                                </div>
                                <Button
                                  size="sm"
                                  variant={
                                    markedForRemoval ? "default" : "secondary"
                                  }
                                  onClick={() =>
                                    setPropertyFormState((prev) => ({
                                      ...prev,
                                      removedMediaIds: markedForRemoval
                                        ? prev.removedMediaIds.filter(
                                            (id) => id !== item.id,
                                          )
                                        : [...prev.removedMediaIds, item.id],
                                    }))
                                  }
                                  className="absolute left-2 top-2"
                                >
                                  {markedForRemoval ? "Keep" : "Remove"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {propertyFormState.uploadFiles.length ? (
                      <div>
                        <p className="text-xs font-medium text-neutral-500">
                          Pending uploads
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-neutral-600">
                          {propertyFormState.uploadFiles.map((file, index) => (
                            <li key={`${file.name}-${index}`}>
                              <span className="truncate pr-2">
                                {file.name}
                                <span className="ml-2 text-xs uppercase text-neutral-400">
                                  {inferMediaType(file) === "video"
                                    ? "Video"
                                    : "Image"}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={previousFormStep}
                  disabled={propertyFormStepIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  onClick={nextFormStep}
                  disabled={propertyFormStepIndex === FORM_STEPS.length - 1}
                >
                  Next
                </Button>
                <Button
                  onClick={() => {
                    console.log("[admin] Save button clicked");
                    void persistProperty();
                  }}
                  disabled={propertySaving}
                >
                  {propertySaving ? "Saving..." : "Save property"}
                </Button>
              </SheetFooter>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TaskForm
        open={taskFormOpen}
        onOpenChange={(open) => {
          setTaskFormOpen(open);
          if (!open) {
            setEditingTask(null);
          }
        }}
        onSubmit={saveTask}
        title={editingTask ? "Edit task" : "Create task"}
        submitLabel={editingTask ? "Save changes" : "Add task"}
        initialValues={taskFormInitialValues}
        loading={taskMutationLoading}
        templates={activeTemplates}
      />

      <ConfirmDialog
        open={deletingTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTaskId(null);
          }
        }}
        onConfirm={() => {
          if (deletingTaskId) {
            const task = tasks.find((item) => item.id === deletingTaskId);
            if (task) {
              void deleteTask(task);
            }
          }
          setDeletingTaskId(null);
        }}
        title="Delete task"
        description="This removes the task from the property."
        confirmLabel="Delete"
        destructive
      >
        <span className="hidden" />
      </ConfirmDialog>
    </div>
  );
}
