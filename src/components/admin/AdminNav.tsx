"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  MapPin,
  UserCheck,
  Database,
  Film,
  GraduationCap,
  Upload,
  Package,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Organizations", href: "/admin/organizations", icon: Building2 },
  { label: "Locations", href: "/admin/locations", icon: MapPin },
  {
    label: "Robot Intelligence",
    href: "/admin/robot-intelligence",
    icon: Database,
  },
  {
    label: "Media Library",
    href: "/admin/robot-intelligence/media",
    icon: Film,
  },
  {
    label: "Training Library",
    href: "/admin/robot-intelligence/training",
    icon: GraduationCap,
  },
  // Consolidated into Media Library - Dec 2025
  // { label: "Contributions", href: "/admin/contributions", icon: Upload },
  { label: "Exports", href: "/admin/exports", icon: Package },
  { label: "Settings", href: "/admin/settings", icon: Settings },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const { claims, loading, initializing } = useAuth();

  if (loading || initializing) {
    return (
      <nav className="hidden w-64 flex-shrink-0 lg:block pl-3">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-[#1f1f1f]"
            />
          ))}
        </div>
      </nav>
    );
  }

  // Show nav for admin, superadmin, or partner_admin
  const isAdmin =
    claims?.role === "admin" ||
    claims?.role === "superadmin" ||
    claims?.role === "partner_admin";
  if (!isAdmin) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Admin"
      className="hidden w-64 flex-shrink-0 lg:block pl-3"
    >
      <ul className="space-y-1 text-sm">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          // Longest-prefix match so Robot Intelligence doesn't stay active
          // when the user is on Media Library / Training Library (siblings
          // share the /admin/robot-intelligence prefix).
          const matches = NAV_ITEMS.filter(
            (item) =>
              pathname === item.href || pathname.startsWith(item.href + "/"),
          );
          const longest = matches.length
            ? matches.reduce((a, b) => (a.href.length >= b.href.length ? a : b))
                .href
            : null;
          const isActive = longest === href;

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600",
                  "hover:translate-x-0.5",
                  isActive
                    ? "bg-gray-100 dark:bg-[#1f1f1f] text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#1f1f1f]"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f1f1f]",
                )}
              >
                <Icon className="h-4 w-4 transition group-hover:scale-105" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
