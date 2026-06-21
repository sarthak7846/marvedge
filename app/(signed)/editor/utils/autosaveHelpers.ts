import { toast } from "react-hot-toast";

export function notifyAutosavePending(isDark: boolean) {
  toast("You made an edit. It will be autosaved.", {
    id: "autosave-toast",
    duration: 3000,
    className: "toast-autosave-card",
    style: {
      background: isDark ? "#0a081a" : "#ffffff",
      color: "#36b37e",
      border: "1px solid #36b37e",
      borderRadius: "8px",
      padding: "10px 18px",
      fontSize: "14px",
      fontWeight: "600",
      whiteSpace: "nowrap",
      boxShadow: isDark ? "0 4px 12px rgba(0, 0, 0, 0.5)" : "0 4px 12px rgba(0, 0, 0, 0.05)",
    },
  });
}
