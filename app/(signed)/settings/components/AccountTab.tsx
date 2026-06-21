import Image from "next/image";
import type { UseSettingsReturn } from "../hooks/useSettings";

type AccountTabProps = {
  settings: UseSettingsReturn;
};

export default function AccountTab({ settings }: AccountTabProps) {
  return (
    <div className="px-2 sm:px-4 md:px-8 lg:px-16 xl:px-24 flex flex-col">
      <div className="w-full mb-12">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Data Management</h2>
        <div className="flex flex-col gap-3 sm:gap-4 px-4 sm:px-6">
          <div className="card account-card flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#F3F0FC] rounded-lg border border-[#ede7fa] p-4 sm:px-6 sm:py-4 gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-[#1A0033]">Update Password</h3>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">
                We will send a secure reset link to your email.
              </div>
            </div>
            <button
              onClick={settings.handleSendPasswordReset}
              disabled={settings.isSendingPasswordReset}
              className="send-btn text-[#7C5CFC] text-sm sm:text-base font-semibold px-4 py-2 rounded-lg border border-[#d9d1fb] bg-white hover:bg-[#ede7fa] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {settings.isSendingPasswordReset ? "Sending..." : "Send Link"}
            </button>
          </div>

          <div className="card delete-card flex flex-col sm:flex-row sm:items-center sm:justify-between bg-red-50 rounded-lg border border-red-200 p-4 sm:px-6 sm:py-4 gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-[#E53E3E]">Delete Account</h3>
              <div className="text-xs sm:text-sm text-red-400 mt-1">
                Once you delete the account, your data cannot be retrieved. Be Certain!
              </div>
            </div>
            <button
              onClick={settings.handleDeleteAccount}
              className="delete-btn text-[#E53E3E] text-xl sm:text-2xl focus:outline-none shrink-0"
            >
              <Image
                src="/icons/icon2.png"
                alt="Chevron Down"
                width={24}
                height={24}
                className="feather feather-chevron-down"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
