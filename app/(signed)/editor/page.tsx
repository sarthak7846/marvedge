"use client";

import { useEffect, useState } from "react";

const EditorPage = () => {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const video = params.get("video");
    setInitialUrl(video);
  }, []);

  return (
    <div className="p-8 grid grid-cols-3 gap-8">
      Editor Page
      <div className="col-span-2">
        {initialUrl && (
          <video src={initialUrl} controls className="w-full rounded" />
        )}
      </div>
      <div>
        {/* <EditorControls onTrim={trimApplier} processing={processing} /> */}
      </div>
    </div>
  );
};

export default EditorPage;
