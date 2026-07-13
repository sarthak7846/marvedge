import React from "react";
import { Eye, CheckCircle2, Clock, MousePointerClick, TrendingUp } from "lucide-react";

interface AnalyticsCard {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendLabel: string;
  icon: React.ReactNode;
  /** pastel card background (Figma card fill, light mode) */
  cardBg: string;
  /** rounded icon tile background (light mode) */
  iconBg: string;
  /** dark-mode hook consumed by app/styles/analytics-dark.css */
  variant: string;
  /** whether the value is rendered at the larger 64px size */
  largeValue: boolean;
}

interface AnalyticsStatCardsProps {
  totalViews: number;
  completionRate: string;
  avgDuration: string;
  ctaClickRate: string;
  isVisible: boolean;
}

const AnalyticsStatCards = ({
  totalViews,
  completionRate,
  avgDuration,
  ctaClickRate,
  isVisible,
}: AnalyticsStatCardsProps) => {
  const cards: AnalyticsCard[] = [
    {
      id: "views",
      label: "Total Views",
      value: totalViews.toString(),
      trend: "+23.2%",
      trendLabel: "vs last month",
      icon: <Eye className="h-8 w-8 text-[#8A76FC] dark:text-[#8b55ff]" />,
      cardBg: "bg-[rgba(197,182,241,0.19)]",
      iconBg: "bg-[rgba(138,118,252,0.14)]",
      variant: "stat-card",
      largeValue: true,
    },
    {
      id: "completion",
      label: "Completion Rate",
      value: completionRate,
      trend: "+5.2%",
      trendLabel: "vs last month",
      icon: <CheckCircle2 className="h-8 w-8 text-[#2F80EC] dark:text-[#3f9bff]" />,
      cardBg: "bg-[rgba(155,225,248,0.14)]",
      iconBg: "bg-[rgba(21,101,216,0.12)]",
      variant: "stat-card blue",
      largeValue: true,
    },
    {
      id: "duration",
      label: "Avg Duration",
      value: avgDuration,
      trend: "+12s",
      trendLabel: "vs last month",
      icon: <Clock className="h-8 w-8 text-[#62408F] dark:text-[#8b55ff]" />,
      cardBg: "bg-[rgba(38,23,83,0.06)]",
      iconBg: "bg-[rgba(98,64,143,0.13)]",
      variant: "stat-card",
      largeValue: false,
    },
    {
      id: "ctr",
      label: "Click through rate",
      value: ctaClickRate,
      trend: "+0.3%",
      trendLabel: "vs last month",
      icon: <MousePointerClick className="h-8 w-8 text-[#E33629] dark:text-[#ff454b]" />,
      cardBg: "bg-[rgba(222,97,14,0.10)]",
      iconBg: "bg-[rgba(222,97,14,0.15)]",
      variant: "stat-card red",
      largeValue: false,
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      {cards.map((card, idx) => (
        <div
          key={card.id}
          style={{ transitionDelay: `${idx * 90}ms` }}
          className={`${card.variant} flex min-h-[220px] flex-col rounded-[15px] border border-transparent p-6 transition-all duration-700 ease-out md:min-h-[240px] md:p-7 ${
            card.cardBg
          } ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          } hover:-translate-y-1`}
        >
          <span
            className={`stat-icon inline-flex h-16 w-16 items-center justify-center rounded-[9px] ${card.iconBg}`}
          >
            {card.icon}
          </span>

          <div className="mt-auto pt-6">
            <p className="text-lg font-normal text-[#261753] dark:text-white/90 md:text-2xl">
              {card.label}
            </p>
            <p
              className={`mt-1 font-medium leading-none text-[rgba(38,23,83,0.72)] dark:text-white ${
                card.largeValue ? "text-5xl lg:text-6xl" : "text-4xl lg:text-5xl"
              }`}
            >
              {card.value}
            </p>
            <p className="mt-4 flex items-center gap-1.5 text-base font-semibold md:text-xl">
              <TrendingUp
                className="h-5 w-5 text-[#36B37E] dark:text-[#25ec7c]"
                strokeWidth={2.4}
              />
              <span className="text-[#36B37E] dark:text-[#25ec7c]">{card.trend}</span>
              <span className="font-normal text-gray-400 dark:text-white/50">
                {card.trendLabel}
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnalyticsStatCards;
