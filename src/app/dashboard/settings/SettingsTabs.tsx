"use client"

import Link from "next/link"

type Tab = "general" | "team"

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "general", label: "General", href: "/dashboard/settings" },
  { id: "team", label: "Team", href: "/dashboard/settings/team" },
]

export default function SettingsTabs({ active }: { active: Tab }) {
  return (
    <div style={{ display: "flex", gap: "4px", borderBottom: "0.5px solid #E5E5E3", marginBottom: "24px" }}>
      {TABS.map(t => {
        const isActive = t.id === active
        return (
          <a
            key={t.id}
            href={t.href}
            style={{
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 500,
              color: isActive ? "#0D1B3E" : "#6B7280",
              borderBottom: isActive ? "2px solid #6D28D9" : "2px solid transparent",
              marginBottom: "-0.5px",
              textDecoration: "none",
            }}
          >
            {t.label}
          </a>
        )
      })}
    </div>
  )
}

