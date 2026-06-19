import { ChangeEvent } from "react";
import type { SettingsForm } from "../utils/settingsHelpers";

type ProfileFormFieldsProps = {
  form: SettingsForm;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

export default function ProfileFormFields({ form, onChange }: ProfileFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
      <div>
        <label className="block text-gray-600 mb-2">First Name</label>
        <input
          type="text"
          name="firstName"
          value={form.firstName}
          onChange={onChange}
          placeholder="Enter your first name here"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Last Name</label>
        <input
          type="text"
          name="lastName"
          value={form.lastName}
          onChange={onChange}
          placeholder="Enter your last name here"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-gray-600 mb-2">Email address</label>
        <input
          type="email"
          name="email"
          value={form.email}
          onChange={onChange}
          placeholder="Enter your email id here"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
          disabled
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-gray-600 mb-2">Bio</label>
        <input
          type="text"
          name="bio"
          value={form.bio}
          onChange={onChange}
          placeholder="Tell us about yourself"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Location</label>
        <input
          type="text"
          name="location"
          value={form.location}
          onChange={onChange}
          placeholder="City, Country"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
        />
      </div>
      <div>
        <label className="block text-gray-600 mb-2">Website</label>
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={onChange}
          placeholder="Paste your link here"
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-[#F8F6FF] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A594F9] shadow-sm"
        />
      </div>
    </div>
  );
}
