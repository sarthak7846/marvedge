"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Play, Award, Zap, Layers, Eye } from "lucide-react";
import { hubHostname } from "@/app/lib/hubDomain";

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
  demos: SerializedDemo[];
}

type HubTab = "featured" | "most-watched" | "newest";

export default function HubClient({ settings, demos }: HubClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("all");

  // Only offer "Featured" when something is actually featured — otherwise the
  // hub's landing view is an empty state for every customer who hasn't curated
  // their library yet.
  const hasFeatured = useMemo(() => demos.some((d) => d.featured), [demos]);
  const [activeTab, setActiveTab] = useState<HubTab>(hasFeatured ? "featured" : "newest");

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
  } as React.CSSProperties;

  return (
    <div
      style={hubStyles}
      className="min-h-screen bg-[var(--hub-accent)] flex flex-col antialiased text-[var(--hub-text)] font-sans"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt="Logo" fill className="object-contain p-1" />
            ) : (
              <span className="text-xl font-bold text-[var(--hub-brand)]">
                {settings.hubTitle.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[var(--hub-text)]">
              {settings.hubTitle}
            </h1>
            <p className="text-xs text-gray-400 font-medium">{hubHostname(settings)}</p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search demos, tags, subtitles..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--hub-brand)] focus:border-transparent transition-all placeholder-gray-400"
          />
        </div>
      </header>

      {/* Hero Showcase Intro */}
      <section className="bg-white px-6 py-12 md:py-16 md:px-12 border-b border-gray-100 text-center max-w-4xl mx-auto w-full mt-6 rounded-2xl shadow-sm">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--hub-text)] mb-4">
          Explore Our Interactive Product Tours
        </h2>
        <p className="text-base text-gray-500 max-w-2xl mx-auto leading-relaxed">
          {settings.hubDescription ||
            "Select a tour below to see how our platforms and tools help streamline your workflows and integrations."}
        </p>

        {/* Integration and Role Pill Filter Section */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Integrations
            </span>
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-[var(--hub-brand)] focus:outline-none"
            >
              <option value="all">All Integrations</option>
              {allIntegrations.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Roles</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white focus:ring-2 focus:ring-[var(--hub-brand)] focus:outline-none"
            >
              <option value="all">All Roles</option>
              {allRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Grid View */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-6">
        {/* Category Tabs Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <div className="flex gap-6">
            {hasFeatured && (
              <button
                onClick={() => setActiveTab("featured")}
                className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === "featured"
                    ? "border-[var(--hub-brand)] text-[var(--hub-brand)]"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                <Award size={16} />
                Featured
              </button>
            )}
            <button
              onClick={() => setActiveTab("most-watched")}
              className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "most-watched"
                  ? "border-[var(--hub-brand)] text-[var(--hub-brand)]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Zap size={16} />
              Most Watched
            </button>
            <button
              onClick={() => setActiveTab("newest")}
              className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "newest"
                  ? "border-[var(--hub-brand)] text-[var(--hub-brand)]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Layers size={16} />
              Newest
            </button>
          </div>

          <div className="text-xs font-semibold text-gray-400">
            Showing {filteredDemos.length} demos
          </div>
        </div>

        {/* Demos Grid */}
        {filteredDemos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-200">
            <Layers size={48} className="text-gray-300 mb-3" />
            <h3 className="text-lg font-bold text-gray-700">No demos found</h3>
            <p className="text-gray-400 text-sm max-w-xs mt-1">
              Try adjusting your search criteria or changing the filters to find relevant tours.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDemos.map((demo) => {
              // Custom share link relative to current route
              const playLink = `/share/${demo.publicLink || demo.id}`;

              return (
                <div
                  key={demo.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                >
                  {/* Thumbnail / Aspect Preview */}
                  <div className="aspect-video bg-slate-900 flex items-center justify-center relative overflow-hidden shrink-0">
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity z-10">
                      <Link
                        href={playLink}
                        className="w-12 h-12 rounded-full bg-[var(--hub-brand)] text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Play size={20} className="fill-current ml-0.5" />
                      </Link>
                    </div>

                    <div className="text-xs font-bold text-white/60 bg-black/40 px-2 py-1 rounded absolute top-3 right-3 flex items-center gap-1 z-10">
                      <Eye size={12} />
                      {demo.viewsCount} views
                    </div>

                    {/* Brand-tinted backing. The hub is white-label, so the
                        placeholder carries the customer's name, not ours. */}
                    <div className="absolute inset-0 bg-[var(--hub-brand)] opacity-25" />
                    <span className="text-2xl font-black tracking-widest text-white/10 uppercase select-none px-4 text-center line-clamp-2">
                      {settings.hubTitle}
                    </span>
                  </div>

                  {/* Body Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Title & Description */}
                      <h3 className="font-bold text-lg text-[var(--hub-text)] line-clamp-1 mb-1.5 group-hover:text-[var(--hub-brand)] transition-colors">
                        {demo.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-4">
                        {demo.description || "No description provided."}
                      </p>

                      {/* Tag badges */}
                      {demo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {demo.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                          {demo.tags.length > 3 && (
                            <span className="text-[10px] font-bold text-gray-400 px-1 py-0.5">
                              +{demo.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2 justify-between items-center text-xs">
                      {/* Integrations */}
                      {demo.integrations.length > 0 && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <span className="font-semibold text-gray-400">Works with:</span>
                          <span className="font-medium text-gray-700 line-clamp-1">
                            {demo.integrations.slice(0, 2).join(", ")}
                          </span>
                        </div>
                      )}

                      {/* Roles */}
                      {demo.userRoles.length > 0 && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <span className="font-semibold text-gray-400">For:</span>
                          <span className="font-medium text-gray-700 line-clamp-1">
                            {demo.userRoles.slice(0, 2).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-400 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto px-6">
          Powered by <span className="font-bold text-gray-500">Marvedge</span> Demo Hub &copy;{" "}
          {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
