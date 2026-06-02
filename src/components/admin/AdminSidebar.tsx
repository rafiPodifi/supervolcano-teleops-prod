"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  MapPin,
  Brain,
  Film,
  GraduationCap,
  Package,
  Settings,
  SprayCan,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface AdminSidebarProps {
  collapsed: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "OPERATIONS",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Cleaners", href: "/admin/cleaners", icon: SprayCan },
      { label: "Organizations", href: "/admin/organizations", icon: Building2 },
      { label: "Locations", href: "/admin/locations", icon: MapPin },
    ],
  },
  {
    title: "DATA",
    items: [
      {
        label: "Robot Intelligence",
        href: "/admin/robot-intelligence",
        icon: Brain,
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
    ],
  },
  {
    title: "OUTPUT",
    items: [{ label: "Exports", href: "/admin/exports", icon: Package }],
  },
];

const settingsItem: NavItem = {
  label: "Settings",
  href: "/admin/settings",
  icon: Settings,
};

export function AdminSidebar({ collapsed }: AdminSidebarProps) {
  const pathname = usePathname();
  const { claims, loading, initializing } = useAuth();

  // Show nav for admin, superadmin, or partner_admin
  const isAdmin =
    claims?.role === "admin" ||
    claims?.role === "superadmin" ||
    claims?.role === "partner_admin";

  if (loading || initializing) {
    return (
      <aside
        className={`fixed left-0 top-16 bottom-0 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#1f1f1f] transition-all duration-200 z-30 ${
          collapsed ? "w-[72px]" : "w-[256px]"
        }`}
      >
        <div className="p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-[#1f1f1f]"
            />
          ))}
        </div>
      </aside>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Robot Intelligence + Media Library + Training Library share a prefix, so
  // a plain startsWith match lights up the parent and the child at the same
  // time. Pick the longest matching nav href and only mark that one active.
  const allNavHrefs = [
    ...navGroups.flatMap((g) => g.items.map((i) => i.href)),
    settingsItem.href,
  ];

  function isActive(href: string) {
    const matches = allNavHrefs.filter(
      (h) => pathname === h || pathname.startsWith(h + "/"),
    );
    if (matches.length === 0) return false;
    const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b));
    return longest === href;
  }

  function NavLink({ item }: { item: NavItem }) {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        href={item.href}
        className={`relative group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
          active
            ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1f1f1f] hover:text-gray-900 dark:hover:text-white"
        } ${collapsed ? "justify-center" : ""}`}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full" />
        )}
        <Icon
          className={`w-5 h-5 flex-shrink-0 ${active ? "text-orange-500" : ""}`}
        />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}

        {/* Tooltip when collapsed */}
        {collapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {item.label}
          </div>
        )}
      </Link>
    );
  }

  return (
    <aside
      className={`fixed left-0 top-16 bottom-0 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#1f1f1f] transition-all duration-200 z-30 flex flex-col ${
        collapsed ? "w-[72px]" : "w-[256px]"
      }`}
    >
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.title}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="p-3 border-t border-gray-200 dark:border-[#1f1f1f]">
        <NavLink item={settingsItem} />
      </div>
    </aside>
  );
}
