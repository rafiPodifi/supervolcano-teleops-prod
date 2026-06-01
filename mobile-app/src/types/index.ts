export interface Location {
  id: string;
  name: string;
  address?: string;
  assignedOrganizationName?: string;
  latitude?: number;
  longitude?: number;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  category?: string;
  locationId: string;
  locationName?: string;
}

export interface UploadQueueItem {
  id: string;
  videoUri: string;
  locationId: string;
  locationName: string;
  jobId: string;
  jobTitle: string;
  timestamp: Date;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
  storageUrl?: string;
}
