"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Search, Play, Bookmark, Zap, Layers, Eye, ChevronDown } from "lucide-react";
import ThemeToggleButton from "@/app/components/signed-header/ThemeToggleButton";

interface SerializedDemo {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  publicLink: string | null;
  createdAt: string;
  shareCount: number;
  tags: string[];
  integrations: string[];
  userRoles: string[];
  featured: boolean;
  viewsCount: number;
  subtitlesText: string;
}

interface HubClientProps {
  settings: {
    logoUrl: string | null;
    brandColor: string;
    textColor: string;
    accentColor: string;
    hubTitle: string;
    hubDescription: string;
    subdomain: string;
    customDomain: string | null;
  };
  user?: {
    name: string | null;
    image: string | null;
  };
  demos: SerializedDemo[];
}

const VIOLET = "#7c5cff";

export default function HubClient({ settings, user, demos }: HubClientProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"featured" | "most-watched" | "newest">("featured");

  // Collect unique integrations and roles for filter dropdowns
  const allIntegrations = useMemo(() => {
    const set = new Set<string>();
    demos.forEach((d) => d.integrations.forEach((i) => set.add(i)));
    return Array.from(set);
  }, [demos]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    demos.forEach((d) => d.userRoles.forEach((r) => set.add(r)));
    return Array.from(set);
  }, [demos]);

  // Client-side filtering & search indexing
  const filteredDemos = useMemo(() => {
    let result = [...demos];

    // 1. Apply category collection tab sorting/filtering
    if (activeTab === "featured") {
      result = result.filter((d) => d.featured);
    } else if (activeTab === "most-watched") {
      result.sort((a, b) => b.viewsCount - a.viewsCount || b.shareCount - a.shareCount);
    } else if (activeTab === "newest") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    // 2. Filter by Integration
    if (selectedIntegration !== "all") {
      result = result.filter((d) => d.integrations.includes(selectedIntegration));
    }

    // 3. Filter by Role
    if (selectedRole !== "all") {
      result = result.filter((d) => d.userRoles.includes(selectedRole));
    }

    // 4. Meta Taxonomy Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((d) => {
        const titleMatch = d.title.toLowerCase().includes(q);
        const descMatch = (d.description || "").toLowerCase().includes(q);
        const tagsMatch = d.tags.some((t) => t.toLowerCase().includes(q));
        const integrationsMatch = d.integrations.some((i) => i.toLowerCase().includes(q));
        const rolesMatch = d.userRoles.some((r) => r.toLowerCase().includes(q));
        const subtitlesMatch = d.subtitlesText.toLowerCase().includes(q);

        return (
          titleMatch || descMatch || tagsMatch || integrationsMatch || rolesMatch || subtitlesMatch
        );
      });
    }

    return result;
  }, [demos, activeTab, selectedIntegration, selectedRole, searchQuery]);

  // Create styling scope with CSS properties
  const hubStyles = {
    "--hub-brand": settings.brandColor,
    "--hub-text": settings.textColor,
    "--hub-accent": settings.accentColor,
    "--hub-accent-hover": settings.brandColor + "15", // 8% opacity of brand color
  } as React.CSSProperties;

  const username = user?.name?.trim() || "there";
  const initials =
    username
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const tabs = [
    { id: "featured" as const, label: "Featured", Icon: Bookmark },
    { id: "most-watched" as const, label: "Most Watched", Icon: Zap },
    { id: "newest" as const, label: "Newest", Icon: Layers },
  ];

  return (
    <div
      style={hubStyles}
      className="min-h-screen bg-[#faf9ff] dark:bg-[#0a0a12] flex flex-col antialiased text-gray-900 dark:text-gray-100 font-sans transition-colors"
    >
      {/* ── Top Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0d0b1c]/95 backdrop-blur border-b border-gray-200/80 dark:border-white/[0.06] py-3 px-4 md:px-8 flex flex-wrap items-center gap-x-5 gap-y-3 shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 mr-auto">
          <div
            className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
            style={{
              backgroundColor: settings.logoUrl ? "transparent" : settings.brandColor || VIOLET,
            }}
          >
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt="Logo" fill className="object-contain p-1" />
            ) : (
              <span className="text-lg font-extrabold text-white select-none">
                {settings.hubTitle.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="leading-tight">
            <h1 className="text-base md:text-lg font-bold tracking-tight text-gray-900 dark:text-white">
              {settings.hubTitle}
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
              {settings.customDomain ? settings.customDomain : `${settings.subdomain}.marvedge.io`}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative order-last w-full md:order-none md:w-auto md:flex-1 md:max-w-md lg:mr-6">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search size={17} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search demos, tags, subtitles..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 bg-gray-50 dark:bg-white/[0.04] dark:border-white/[0.08] text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:bg-white dark:focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/60 focus:border-transparent transition-all"
          />
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3 md:gap-4 ml-auto md:ml-0">
          <ThemeToggleButton isDark={isDark} setTheme={setTheme} />

          <p className="hidden lg:block text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
            Welcome <span className="font-bold text-[#7c5cff] dark:text-[#9d85ff]">{username}</span>
          </p>

          {/* User avatar */}
          <div
            className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#7c5cff]/30"
            style={{ backgroundColor: user?.image ? "transparent" : settings.brandColor || VIOLET }}
            title={username}
          >
            {user?.image ? (
              <Image src={user.image} alt={username} fill className="object-cover" />
            ) : (
              <span className="select-none">{initials}</span>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <main
        className={`flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 pt-8 pb-14 ${demos.length > 0 ? "space-y-7" : ""}`}
      >
        <section className="rounded-2xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-[#12101f] shadow-sm px-6 py-10 md:p-12 text-center">
          <h2 className="text-3xl md:text-[2.75rem] leading-tight font-extrabold tracking-tight mb-4 bg-gradient-to-r from-[#6a3df5] via-[#7c5cff] to-[#9d7bff] bg-clip-text text-transparent">
            Explore Our Interactive Product Tours
          </h2>
          <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            {settings.hubDescription ||
              "Interactive product tours for every team — search by integration or role."}
          </p>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-9 max-w-3xl mx-auto text-left">
            {[
              {
                label: "Integrations",
                value: selectedIntegration,
                setValue: setSelectedIntegration,
                options: allIntegrations,
                allLabel: "All Integrations",
              },
              {
                label: "Roles",
                value: selectedRole,
                setValue: setSelectedRole,
                options: allRoles,
                allLabel: "All Roles",
              },
            ].map(({ label, value, setValue, options, allLabel }) => (
              <div key={label}>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5 pl-0.5">
                  {label}
                </label>
                <div className="relative">
                  <select
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-white/[0.03] px-4 py-2.5 pr-10 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7c5cff]/60 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="all">{allLabel}</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tabs row ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-white/[0.08] pb-1">
          <div className="flex gap-5 sm:gap-7 overflow-x-auto">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`pb-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === id
                    ? "border-[#7c5cff] text-[#7c5cff] dark:text-[#9d85ff]"
                    : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 whitespace-nowrap pl-4">
            Showing {filteredDemos.length} demos
          </div>
        </div>

        {/* ── Demo grid ────────────────────────────────────────────── */}
        {filteredDemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center bg-white dark:bg-[#12101f] rounded-2xl border border-gray-200/80 dark:border-white/[0.06]">
            <Layers size={48} className="text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">No demos found</h3>
            <p className="text-gray-400 dark:text-gray-500 text-sm max-w-xs mt-1">
              Try adjusting your search criteria or changing the filters to find relevant tours.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDemos.map((demo) => {
              // Custom share link relative to current route
              const playLink = `/share/${demo.publicLink || demo.id}`;

              return (
                <article
                  key={demo.id}
                  className="bg-white dark:bg-[#12101f] rounded-2xl border border-gray-200/80 dark:border-white/[0.06] overflow-hidden flex flex-col shadow-sm hover:shadow-lg dark:hover:shadow-black/40 hover:-translate-y-1 transition-all duration-300 group"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video relative overflow-hidden shrink-0 bg-gradient-to-br from-[#ede9fe] via-[#e4dcff] to-[#ddd2ff] dark:from-[#241d45] dark:via-[#1b1638] dark:to-[#141126]">
                    {/* Views badge */}
                    <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/45 text-white px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                      <Eye size={12} />
                      {demo.viewsCount} views
                    </div>

                    {/* Centered play button */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      <Link
                        href={playLink}
                        aria-label={`Play ${demo.title}`}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8a63ff] to-[#5c38f7] text-white flex items-center justify-center shadow-lg shadow-[#7c5cff]/40 group-hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Play size={22} className="fill-current ml-0.5" />
                      </Link>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-50 line-clamp-1 mb-1 group-hover:text-[#7c5cff] dark:group-hover:text-[#9d85ff] transition-colors">
                      {demo.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 leading-relaxed mb-3">
                      {demo.description || "No description provided."}
                    </p>

                    {/* Tag pills */}
                    {demo.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {demo.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#7c5cff]/[0.08] text-[#6d4ef5] dark:bg-[#7c5cff]/[0.16] dark:text-[#a78bff] border border-[#7c5cff]/15"
                          >
                            {tag}
                          </span>
                        ))}
                        {demo.tags.length > 3 && (
                          <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 px-1 py-0.5">
                            +{demo.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer meta */}
                    <div className="mt-auto border-t border-gray-100 dark:border-white/[0.06] pt-3 flex flex-wrap gap-x-4 gap-y-1.5 justify-between items-center text-xs">
                      {demo.integrations.length > 0 && (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-medium text-gray-400 dark:text-gray-500">
                            Works with
                          </span>
                          <span className="font-bold text-gray-700 dark:text-gray-200 truncate">
                            {demo.integrations.slice(0, 2).join(", ")}
                          </span>
                        </div>
                      )}

                      {demo.userRoles.length > 0 && (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-medium text-gray-400 dark:text-gray-500">For:</span>
                          <span className="font-bold text-gray-700 dark:text-gray-200 truncate">
                            {demo.userRoles.slice(0, 2).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#0d0b1c] border-t border-gray-200/80 dark:border-white/[0.06] py-6 text-center text-xs text-gray-400 dark:text-gray-500 mt-auto shrink-0">
        <div className="max-w-7xl mx-auto px-6">
          Powered by <span className="font-bold text-gray-500 dark:text-gray-400">Marvedge</span>{" "}
          Demo Hub &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
