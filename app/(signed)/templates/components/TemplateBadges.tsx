import type { Template } from "../templateData";

interface TemplateBadgesProps {
  tpl: Template;
}

export default function TemplateBadges({ tpl }: TemplateBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
      {tpl.popular && (
        <span className="bg-[#F8E7A1] text-[#E6B800] text-xs font-semibold px-2 py-1 rounded mr-1 sm:mr-2">
          ★ Popular
        </span>
      )}
      {tpl.badge && tpl.badge !== "Popular" && (
        <span className="bg-[#E7F8E7] text-[#4CAF50] text-xs font-semibold px-2 py-1 rounded">
          {tpl.badge}
        </span>
      )}
      {tpl.level && tpl.level !== "Beginner" && tpl.level !== "Advanced" && (
        <span className="bg-[#E7F8E7] text-[#4CAF50] text-xs font-semibold px-2 py-1 rounded">
          {tpl.level}
        </span>
      )}
      {tpl.level === "Beginner" && (
        <span className="bg-[#E7F8E7] text-[#4CAF50] text-xs font-semibold px-2 py-1 rounded">
          Beginner
        </span>
      )}
      {tpl.level === "Intermediate" && (
        <span className="bg-[#F8F3E7] text-[#E6B800] text-xs font-semibold px-2 py-1 rounded">
          Intermediate
        </span>
      )}
      {tpl.level === "Advanced" && (
        <span className="bg-[#F8E7E7] text-[#E64A19] text-xs font-semibold px-2 py-1 rounded">
          Advanced
        </span>
      )}
    </div>
  );
}
