"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, Users, ClipboardList } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function OrgNav() {
  const pathname = usePathname();
  const { claims, loading, initializing } = useAuth();

  const role = (claims?.role as string | undefined) ?? "oem_teleoperator";
  const isManager = role === "org_manager";

  if (loading || initializing) {
    return (
      <nav className="hidden w-56 flex-shrink-0 lg:block">
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-lg bg-neutral-100"
            />
          ))}
        </div>
      </nav>
    );
  }

  const NAV_ITEMS = [
    {
      label: isManager ? "Dashboard" : "Home",
      href: "/org/dashboard",
      icon: LayoutDashboard,
    },
    { label: "Locations", href: "/org/locations", icon: MapPin },
    ...(isManager ? [{ label: "Team", href: "/org/team", icon: Users }] : []),
    {
      label: isManager ? "Task History" : "My Tasks",
      href: "/org/tasks",
      icon: ClipboardList,
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Organization"
      className="hidden w-56 flex-shrink-0 lg:block"
    >
      <ul className="space-y-1 text-sm">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          // Longest-prefix match so a parent nav item doesn't stay active
          // when the user is on a sibling that shares its prefix.
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
                  "group flex items-center gap-2 rounded-lg px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
                  "hover:translate-x-0.5 hover:bg-neutral-100",
                  isActive && "bg-neutral-900 text-white hover:bg-neutral-900",
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
