import { useEffect } from "react";
import type { Session } from "next-auth";
import type { Dispatch, SetStateAction } from "react";
import { fetchUser, mapUserToForm, type SettingsForm } from "../utils/settingsHelpers";

type UseLoadUserArgs = {
  session: Session | null;
  setForm: Dispatch<SetStateAction<SettingsForm>>;
  setOriginalForm: Dispatch<SetStateAction<SettingsForm>>;
  setAvatar: Dispatch<SetStateAction<string>>;
};

export function useLoadUser({ session, setForm, setOriginalForm, setAvatar }: UseLoadUserArgs) {
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      firstName: session?.user?.name?.split(" ")[0] || "",
      lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
      email: session?.user?.email || "",
    }));

    const loadUser = async () => {
      const user = await fetchUser();
      if (user) {
        console.log(user.image, user.name);
        setAvatar(user.image || "");
        setForm((prev) => ({ ...prev, ...mapUserToForm(user) }));
      }
    };

    loadUser();
  }, [session, setForm, setAvatar]);

  useEffect(() => {
    const loadUser = async () => {
      const user = await fetchUser();
      if (user) {
        const userFormData = mapUserToForm(user);
        setForm(userFormData);
        setOriginalForm(userFormData);
      }
    };
    loadUser();
  }, [session, setForm, setOriginalForm]);
}
