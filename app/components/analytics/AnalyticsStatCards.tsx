import React from "react";
import {
  Eye,
  CheckCircle,
  Clock,
  Share2,
  MousePointerClick,
  Users,
  Percent,
  Trophy,
} from "lucide-react";

interface AnalyticsCard {
  id: string;
  label: string;
  value: string;
  trend?: string;
  trendLabel: string;
  icon: React.ReactNode;
  bgColor: string;
  hoverColor: string;
  shadow: string;
  textColor: string;
}

interface AnalyticsStatCardsProps {
  totalViews: number;
  avgDuration: string;
  completionRate: string;
  activeShares: number;
  totalCtaClicks: number;
  uniqueCtaClicks: number;
  ctaClickRate: string;
  topCta: { label: string; clicks: number } | null;
  isVisible: boolean;
  hoveredCard: string | null;
  onHover: (cardId: string) => void;
  onLeave: () => void;
}

const AnalyticsStatCards = ({
  totalViews,
  avgDuration,
  completionRate,
  activeShares,
  totalCtaClicks,
  uniqueCtaClicks,
  ctaClickRate,
  topCta,
  isVisible,
  hoveredCard,
  onHover,
  onLeave,
}: AnalyticsStatCardsProps) => {
  const cards: AnalyticsCard[] = [
    {
      id: "views",
      label: "Total Views",
      value: totalViews.toString(),
      trend: "+12%",
      trendLabel: "vs last month",
      icon: <Eye className="w-6 h-6 md:w-7 md:h-7 text-[#8A76FC]" />,
      bgColor: "bg-[#C5B6F1]/19",
      hoverColor: "from-[#C5B6F1] to-[#8A76FC]",
      shadow: "shadow-[#8A76FC]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "completion",
      label: "Completion Rate",
      value: completionRate,
      trend: "+5.2%",
      trendLabel: "vs last month",
      icon: <CheckCircle className="w-6 h-6 md:w-7 md:h-7 text-[#2F80EC]" />,
      bgColor: "bg-[#9BE1F8]/14",
      hoverColor: "from-[#9BE1F8] to-[#2F80EC]",
      shadow: "shadow-[#2F80EC]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "duration",
      label: "Avg Duration",
      value: avgDuration,
      trend: "+2s",
      trendLabel: "vs last month",
      icon: <Clock className="w-6 h-6 md:w-7 md:h-7 text-[#6356D7]" />,
      bgColor: "bg-[#261753]/6",
      hoverColor: "from-[#E6E1FA] to-[#C5B6F1]",
      shadow: "shadow-[#6356D7]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "shares",
      label: "Active Shares",
      value: activeShares.toString(),
      trend: "+8.3%",
      trendLabel: "vs last month",
      icon: <Share2 className="w-6 h-6 md:w-7 md:h-7 text-[#E33629]" />,
      bgColor: "bg-[#DE610E]/10",
      hoverColor: "from-[#F9E6E6] to-[#E33629]",
      shadow: "shadow-[#E33629]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "ctaClicks",
      label: "CTA Clicks",
      value: totalCtaClicks.toString(),
      trendLabel: "total clicks",
      icon: <MousePointerClick className="w-6 h-6 md:w-7 md:h-7 text-[#8A76FC]" />,
      bgColor: "bg-[#C5B6F1]/19",
      hoverColor: "from-[#C5B6F1] to-[#8A76FC]",
      shadow: "shadow-[#8A76FC]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "uniqueClicks",
      label: "Unique Clicks (per browser)",
      value: uniqueCtaClicks.toString(),
      trendLabel: "distinct viewers",
      icon: <Users className="w-6 h-6 md:w-7 md:h-7 text-[#2F80EC]" />,
      bgColor: "bg-[#9BE1F8]/14",
      hoverColor: "from-[#9BE1F8] to-[#2F80EC]",
      shadow: "shadow-[#2F80EC]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "ctaRate",
      label: "CTA Click Rate (per browser)",
      value: ctaClickRate,
      trendLabel: "unique clicks ÷ views",
      icon: <Percent className="w-6 h-6 md:w-7 md:h-7 text-[#6356D7]" />,
      bgColor: "bg-[#261753]/6",
      hoverColor: "from-[#E6E1FA] to-[#C5B6F1]",
      shadow: "shadow-[#6356D7]/50",
      textColor: "text-[#261753]",
    },
    {
      id: "topCta",
      label: "Top CTA",
      value: topCta?.label ?? "—",
      trendLabel: topCta ? `${topCta.clicks} clicks` : "no clicks yet",
      icon: <Trophy className="w-6 h-6 md:w-7 md:h-7 text-[#E33629]" />,
      bgColor: "bg-[#DE610E]/10",
      hoverColor: "from-[#F9E6E6] to-[#E33629]",
      shadow: "shadow-[#E33629]/50",
      textColor: "text-[#261753]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
      {cards.map((card, idx) => (
        <AnalyticsStatCard
          key={card.id}
          card={card}
          idx={idx}
          isVisible={isVisible}
          hoveredCard={hoveredCard}
          onHover={onHover}
          onLeave={onLeave}
        />
      ))}
    </div>
  );
};

interface AnalyticsStatCardProps {
  card: AnalyticsCard;
  idx: number;
  isVisible: boolean;
  hoveredCard: string | null;
  onHover: (cardId: string) => void;
  onLeave: () => void;
}

const AnalyticsStatCard = ({
  card,
  idx,
  isVisible,
  hoveredCard,
  onHover,
  onLeave,
}: AnalyticsStatCardProps) => (
  <div
    onMouseEnter={() => onHover(card.id)}
    onMouseLeave={onLeave}
    className={`
              stat-card
              ${card.id === "completion" ? "blue" : card.id === "shares" ? "red" : ""}
              ${
                card.bgColor
              } rounded-xl p-4 md:p-6 flex flex-col items-start shadow-sm min-h-[120px] md:min-h-[140px]
              transition-all duration-700 delay-${idx * 100}
              cursor-pointer
              ${
                isVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-8 scale-95"
              }
              ${
                hoveredCard === card.id
                  ? `scale-110 shadow-2xl ${card.shadow} rotate-2 bg-linear-to-br ${card.hoverColor}`
                  : "hover:scale-105 hover:shadow-lg"
              }
            `}
  >
    <div className="mb-2">
      <span
        className={`
                  stat-icon
                  inline-block p-2 rounded-lg transition-all duration-300
                  ${hoveredCard === card.id ? `scale-110 ${card.bgColor}` : card.bgColor}
                `}
      >
        {card.icon}
      </span>
    </div>
    <div className="stat-label text-sm md:text-lg font-medium text-[#261753]">{card.label}</div>
    <div
      className={`stat-value text-2xl md:text-3xl font-bold text-[#261753] truncate max-w-full ${
        hoveredCard === card.id ? card.textColor : ""
      }`}
    >
      {card.value}
    </div>
    <div className="trend text-sm text-green-600 font-semibold mt-1 flex items-center">
      {card.trend ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5 mr-1 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
          </svg>
          <strong>{card.trend}</strong>{" "}
        </>
      ) : null}
      <span className="text-gray-500 font-normal ml-1">{card.trendLabel}</span>
    </div>
  </div>
);

export default AnalyticsStatCards;
