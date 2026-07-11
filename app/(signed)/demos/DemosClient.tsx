"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import { useDemosData } from "./hooks/useDemosData";
import { useDemosStore } from "@/app/store/demosStore";
import { buildDemoEditorParams, filterAndSortDemos } from "./utils/demoHelpers";
import DemosToolbar from "./components/DemosToolbar";
import DemoGridView from "./components/DemoGridView";
import DemoListView from "./components/DemoListView";
import type { Demo } from "./types";

export const metadata = {
  titleText: "My Demos",
  iconSRC: "/Group.png",
};

interface DemosPageProps {
  initialDemos: Demo[];
}

export default function DemosPage({ initialDemos }: DemosPageProps) {
  const router = useRouter();

  // Filters live in the demosStore so the toolbar reads/writes them directly.
  const search = useDemosStore((s) => s.search);
  const view = useDemosStore((s) => s.view);
  const sortOption = useDemosStore((s) => s.sortOption);

  // Local UI state for the delete modal stays as component state.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { demos, loading, error, deleteDemo } = useDemosData(initialDemos);

  const filteredAndSortedDemos = filterAndSortDemos(demos, search, sortOption);

  const handleEditDemo = (demo: Demo) => {
    router.push(`/editor?${buildDemoEditorParams(demo)}`);
  };

  const handleDeleteDemo = (id: string) => {
    setDeleteId(id);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) {
      return;
    }
    await deleteDemo(deleteId);
    setIsModalOpen(false);
    setDeleteId(null);
  };

  return (
    <div className="demos-page min-h-screen bg-[#F3F0FC]">
      <div className="demos-body rounded-xl p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-normal text-[#8B8B8B] dark:text-[var(--text-muted)] mb-2">
            Manage and organize all your interactive demos.
          </h2>
          <DemosToolbar />
        </div>
        <div className="mt-8">
          <h3 className="text-3xl font-semibold text-[#1A0033] dark:text-[var(--text-primary)] mb-6">
            Your Demos
          </h3>
          <div className="flex justify-end text-[#A594F9] dark:text-[var(--purple-light)] mb-2 font-medium">
            {filteredAndSortedDemos.length}/{demos.length} demos
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[#A594F9] text-lg">Loading demos...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-500 text-lg">{error}</div>
            </div>
          ) : filteredAndSortedDemos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[#8B8B8B] text-lg">No demos found</div>
            </div>
          ) : view === "grid" ? (
            <DemoGridView
              demos={filteredAndSortedDemos}
              onEdit={handleEditDemo}
              onDelete={handleDeleteDemo}
            />
          ) : (
            <DemoListView
              demos={filteredAndSortedDemos}
              onEdit={handleEditDemo}
              onDelete={handleDeleteDemo}
            />
          )}
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={isModalOpen}
        onConfirm={confirmDelete}
        onCancel={() => setIsModalOpen(false)}
      />
    </div>
  );
}
