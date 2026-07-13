export type MainTab = "background" | "tools" | "cta" | "avs";
export type BgSubTab = "image" | "gradient" | "color" | "hidden";

export interface ImageBackgroundOption {
  id: string;
  name: string;
  thumbnail: string;
  type: "default" | "solid" | "gradient";
}

export interface GradientOption {
  id: string;
  name: string;
  css: string;
}

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
}

export const imageBackgroundOptions: ImageBackgroundOption[] = [
  {
    id: "def_mac_1",
    name: "mac-1",
    thumbnail: "/background-default-images/mac-1.jpg",
    type: "default",
  },
  {
    id: "def_mac_2",
    name: "mac-2",
    thumbnail: "/background-default-images/mac-2.jpg",
    type: "default",
  },
  {
    id: "def_mac_3",
    name: "mac-3",
    thumbnail: "/background-default-images/mac-3.jpg",
    type: "default",
  },
  {
    id: "def_mac_4",
    name: "mac-4",
    thumbnail: "/background-default-images/mac-4.jpg",
    type: "default",
  },
  {
    id: "def_windows_1",
    name: "windows-1",
    thumbnail: "/background-default-images/windows-1.jpg",
    type: "default",
  },
  {
    id: "def_windows_2",
    name: "windows-2",
    thumbnail: "/background-default-images/windows-2.jpg",
    type: "default",
  },
  {
    id: "def_windows_3",
    name: "windows-3",
    thumbnail: "/background-default-images/windows-3.png",
    type: "default",
  },
  {
    id: "def_windows_4",
    name: "windows-4",
    thumbnail: "/background-default-images/windows-4.jpg",
    type: "default",
  },

  {
    id: "solid_blue_1",
    name: "blue-1",
    thumbnail: "/solid/blue-1.png",
    type: "solid",
  },
  {
    id: "solid_blue_2",
    name: "blue-2",
    thumbnail: "/solid/blue-2.png",
    type: "solid",
  },
  {
    id: "solid_blue_3",
    name: "blue-3",
    thumbnail: "/solid/blue-3.png",
    type: "solid",
  },
  {
    id: "solid_blue_4",
    name: "blue-4",
    thumbnail: "/solid/blue-4.png",
    type: "solid",
  },
  {
    id: "solid_green_1",
    name: "green-1",
    thumbnail: "/solid/green-1.png",
    type: "solid",
  },
  {
    id: "solid_green_2",
    name: "green-2",
    thumbnail: "/solid/green-2.png",
    type: "solid",
  },
  {
    id: "solid_green_3",
    name: "green-3",
    thumbnail: "/solid/green-3.png",
    type: "solid",
  },
  {
    id: "solid_green_4",
    name: "green-4",
    thumbnail: "/solid/green-4.png",
    type: "solid",
  },
  {
    id: "solid_orange_1",
    name: "orange-1",
    thumbnail: "/solid/orange-1.png",
    type: "solid",
  },
  {
    id: "solid_orange_2",
    name: "orange-2",
    thumbnail: "/solid/orange-2.png",
    type: "solid",
  },
  {
    id: "solid_orange_3",
    name: "orange-3",
    thumbnail: "/solid/orange-3.png",
    type: "solid",
  },
  {
    id: "solid_orange_4",
    name: "orange-4",
    thumbnail: "/solid/orange-4.png",
    type: "solid",
  },
  {
    id: "solid_red_1",
    name: "red-1",
    thumbnail: "/solid/red-1.jpg",
    type: "solid",
  },
  {
    id: "solid_red_2",
    name: "red-2",
    thumbnail: "/solid/red-2.jpg",
    type: "solid",
  },
  {
    id: "solid_red_3",
    name: "red-3",
    thumbnail: "/solid/red-3.jpg",
    type: "solid",
  },
  {
    id: "solid_red_4",
    name: "red-4",
    thumbnail: "/solid/red-4.jpg",
    type: "solid",
  },
  {
    id: "solid_yellow_1",
    name: "yellow-1",
    thumbnail: "/solid/yellow-1.png",
    type: "solid",
  },
  {
    id: "solid_yellow_2",
    name: "yellow-2",
    thumbnail: "/solid/yellow-2.png",
    type: "solid",
  },
  {
    id: "solid_yellow_3",
    name: "yellow-3",
    thumbnail: "/solid/yellow-3.png",
    type: "solid",
  },
  {
    id: "solid_yellow_4",
    name: "yellow-4",
    thumbnail: "/solid/yellow-4.png",
    type: "solid",
  },

  {
    id: "grad_dark_1",
    name: "gradient-dark-1",
    thumbnail: "/gradient/gradient_dark-1.jpg",
    type: "gradient",
  },
  {
    id: "grad_dark_2",
    name: "gradient-dark-2",
    thumbnail: "/gradient/gradient_dark-2.jpg",
    type: "gradient",
  },
  {
    id: "grad_dark_3",
    name: "gradient-dark-3",
    thumbnail: "/gradient/gradient_dark-3.jpg",
    type: "gradient",
  },
  {
    id: "grad_dark_4",
    name: "gradient-dark-4",
    thumbnail: "/gradient/gradient_dark-4.jpg",
    type: "gradient",
  },
  {
    id: "grad_light_1",
    name: "gradient-light-1",
    thumbnail: "/gradient/gradient_light-1.png",
    type: "gradient",
  },
  {
    id: "grad_light_2",
    name: "gradient-light-2",
    thumbnail: "/gradient/gradient_light-2.jpg",
    type: "gradient",
  },
  {
    id: "grad_light_3",
    name: "gradient-light-3",
    thumbnail: "/gradient/gradient_light-3.png",
    type: "gradient",
  },
  {
    id: "grad_light_4",
    name: "gradient-light-4",
    thumbnail: "/gradient/gradient_light-4.jpg",
    type: "gradient",
  },
];

export const gradientOptions: GradientOption[] = [
  {
    id: "sunset",
    name: "Sunset",
    css: "bg-gradient-to-br from-pink-500 via-orange-400 to-yellow-300",
  },
  {
    id: "ocean",
    name: "Ocean",
    css: "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700",
  },
  {
    id: "mint",
    name: "Mint",
    css: "bg-gradient-to-br from-emerald-300 via-teal-400 to-cyan-500",
  },
  {
    id: "royal",
    name: "Royal",
    css: "bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600",
  },
  {
    id: "steel",
    name: "Steel",
    css: "bg-gradient-to-br from-slate-700 via-slate-500 to-slate-300",
  },
  {
    id: "candy",
    name: "Candy",
    css: "bg-gradient-to-br from-rose-400 via-fuchsia-500 to-violet-600",
  },
];

export const colorOptions: ColorOption[] = [
  { id: "#111827", name: "Near Black", hex: "#111827" },
  { id: "#0ea5e9", name: "Sky", hex: "#0ea5e9" },
  { id: "#7c3aed", name: "Violet", hex: "#7c3aed" },
  { id: "#22c55e", name: "Green", hex: "#22c55e" },
  { id: "#f59e0b", name: "Amber", hex: "#f59e0b" },
  { id: "#ef4444", name: "Red", hex: "#ef4444" },
  { id: "#e5e7eb", name: "Light", hex: "#e5e7eb" },
  { id: "#0f172a", name: "Slate", hex: "#0f172a" },
];
