import { NavLink } from "react-router-dom";

const nav = [
  { to: "/dashboard",  label: "Dashboard",  icon: "\u2B21" },
  { to: "/clients",    label: "Clients",     icon: "\uD83D\uDC64" },
  { to: "/schedule",   label: "Schedule",    icon: "\uD83D\uDCC5" },
  { to: "/jobs",       label: "Jobs",        icon: "\uD83D\uDCCB" },
  { to: "/services",   label: "Services",    icon: "\uD83D\uDCE6" },
  { to: "/maintenance", label: "Maintenance", icon: "\uD83D\uDD27" },
  { to: "/quotes",     label: "Quotes",      icon: "\uD83D\uDCC4" },
  { to: "/invoices",   label: "Invoices",    icon: "\uD83D\uDCB0" },
  { to: "/reports",    label: "Reports",     icon: "\uD83D\uDCCA" },
  { to: "/ai-activity", label: "AI Activity", icon: "\uD83E\uDDE0" },
];

export default function Sidebar() {
  return (
    <aside className="flex flex-col w-56 bg-turf-900 text-white shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-turf-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-turf-500 rounded-lg flex items-center justify-center text-lg">
            🌿
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">AgenticMeadows</p>
            <p className="text-turf-400 text-xs">Field Service</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-turf-700 text-white"
                  : "text-turf-300 hover:bg-turf-800 hover:text-white"
              }`
            }
          >
            <span className="text-base w-5 text-center">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-turf-800">
        <p className="text-turf-500 text-xs">Powered by Qwen 3.5 · Ollama</p>
        <p className="text-turf-600 text-xs">100% Local · No Cloud</p>
      </div>
    </aside>
  );
}
