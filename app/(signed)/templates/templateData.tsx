import Image from "next/image";

export interface Template {
  title: string;
  description: string;
  time: string;
  level: string;
  type: string;
  popular: boolean;
  badge?: string;
}

export const templates: Template[] = [
  {
    title: "SaaS Product Onboarding",
    description:
      "Complete user onboarding flow for a SaaS application with guided tour of key features.",
    time: "15m",
    level: "Beginner",
    type: "saas",
    popular: true,
    badge: "Popular",
  },
  {
    title: "E-commerce Checkout Flow",
    description: "Demonstrate the complete checkout process from cart to payment confirmation.",
    time: "20m",
    level: "Intermediate",
    type: "e commerce",
    popular: true,
    badge: "Popular",
  },
  {
    title: "Mobile App Tutorial",
    description: "Demonstrate the interactive tutorial for mobile app first time users",
    time: "10m",
    level: "Beginner",
    type: "mobile",
    popular: false,
  },
  {
    title: "Web Dashboard Overview",
    description: "Overview of a comprehensive walkthrough of an analytics dashboard.",
    time: "25m",
    level: "Beginner",
    type: "web",
    popular: true,
    badge: "Popular",
  },
  {
    title: "API Integration Guide",
    description: "Step-by-step API integration demonstration for developers",
    time: "30m",
    level: "Advanced",
    type: "web",
    popular: false,
    badge: "Advanced",
  },
  {
    title: "Customer Support Flow",
    description: "Complete customer support ticket creation and tracking process.",
    time: "10m",
    level: "Beginner",
    type: "saas",
    popular: false,
  },
];

export const sortOptions = [
  {
    label: "Title",
    icon: (
      <Image
        src="/icons/title.png"
        alt="Notifications"
        width={24}
        height={24}
        className="w-6 h-6"
      />
    ),
  },
  {
    label: "Last Updated",
    icon: (
      <Image
        src="/icons/history.png"
        alt="Notifications"
        width={24}
        height={24}
        className="w-6 h-6"
      />
    ),
  },
  {
    label: "Created date",
    icon: (
      <Image
        src="/icons/created-date.png"
        alt="Notifications"
        width={24}
        height={24}
        className="w-6 h-6"
      />
    ),
  },
  {
    label: "Views",
    icon: (
      <Image
        src="/icons/views.png"
        alt="Notifications"
        width={24}
        height={24}
        className="w-6 h-6"
      />
    ),
  },
];
