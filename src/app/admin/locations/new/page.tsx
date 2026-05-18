"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  MapPin,
  Building2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import AddressAutocomplete from "@/components/admin/AddressAutocomplete";

export default function NewLocationPage() {
  const router = useRouter();
  const { user, claims, getIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Location name is required");
      return;
    }

    if (!user) {
      setError("You must be logged in");
      return;
    }

    // Admin/superadmin belong to SuperVolcano internal and have no partnerId
    // claim. Other roles must have one assigned.
    const isAdmin = claims?.role === "admin" || claims?.role === "superadmin";
    const partnerOrgId = claims?.partnerId || (isAdmin ? "sv:internal" : null);

    if (!partnerOrgId) {
      setError(
        "Your account has no partner organization assigned. Contact an admin.",
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await getIdToken();

      const response = await fetch("/api/v1/locations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
          type: "other",
          partnerOrgId,
          status: "active",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create location");
      }

      const data = await response.json();

      // Redirect to location detail page where wizard will auto-show
      router.push(`/admin/locations/${data.locationId}`);
    } catch (err: any) {
      console.error("Failed to create location:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-[#1f1f1f]">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/locations"
              className="p-2 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Create New Location
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Step 1 of 3
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-4 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-orange-500">
                Basic Info
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-[#2a2a2a]" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-[#2a2a2a] text-gray-400 dark:text-gray-500 rounded-full flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                Build Structure
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-[#2a2a2a]" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-[#2a2a2a] text-gray-400 dark:text-gray-500 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium">✓</span>
              </div>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                Review
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-xl font-semibold mb-2">Location Details</h2>
          <p className="text-gray-600 mb-6">
            Enter the basic information about this location.
          </p>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Isaac's House"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <AddressAutocomplete
                value={address}
                onChange={(addressData) => {
                  setAddress(addressData.fullAddress);
                }}
                placeholder="Start typing an address..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">💡 Next step:</span> You will
                build the structure of this location by adding floors, rooms,
                and cleaning targets.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          <Link
            href="/admin/locations"
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back
          </Link>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            0 tasks will be created
          </div>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
