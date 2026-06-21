import { useMemo, useState, ChangeEvent } from "react";
import type { Session } from "next-auth";
import type { SettingsForm } from "../utils/settingsHelpers";

export function useProfileForm(session: Session | null) {
  const [form, setForm] = useState<SettingsForm>({
    firstName: session?.user?.name?.split(" ")[0] || "",
    lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
    email: session?.user?.email || "",
    bio: "",
    location: "",
    website: "",
    timezone: "",
    image: "",
  });
  const [originalForm, setOriginalForm] = useState<SettingsForm>({ ...form });
  const [isDirty, setIsDirty] = useState(false);

  const initials = useMemo(() => {
    if (session?.user?.name) {
      return session.user.name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return session?.user?.email?.[0].toUpperCase() || "U";
  }, [session?.user]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  }, [form, originalForm]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsDirty(true);
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return {
    form,
    setForm,
    originalForm,
    setOriginalForm,
    isDirty,
    setIsDirty,
    initials,
    hasChanges,
    handleInputChange,
  };
}
