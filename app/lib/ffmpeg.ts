// import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

// export const ffmpeg = createFFmpeg({
//   log: true,
//   corePath: "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js", // adjust if needed
// });

// export const ffmpegLoadedEnsurer = async () => {
//   if (!ffmpeg.isLoaded()) {
//     await ffmpeg.load();
//   }
// };

// export const videoTrimmer = async (inputName, outputName, start, end) => {
//   await ffmpegLoadedEnsurer();
//   await ffmpeg.FS("writeFile", inputName, await fetchFile(`/tmp/${inputName}`));
//   await ffmpeg.run(
//     "-i",
//     inputName,
//     "-ss",
//     start,
//     "-to",
//     end,
//     "-c",
//     "copy",
//     outputName
//   );
//   const data = ffmpeg.FS("readFile", outputName);
//   return new Blob([data.buffer], { type: "video/webm" });
// };

// /**
//  * Note: in dev you can write the raw Blob into /tmp/input.webm via ffmpeg.FS("writeFile", …).
//  * In production you might need to convert the Blob to Uint8Array manually.
//  */
