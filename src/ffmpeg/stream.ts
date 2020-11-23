import { Request, Response } from "express";
import ffmpeg from "fluent-ffmpeg";
import path from "path";

import Scene from "../types/scene";
import {
  audioIsValidForContainer,
  FFProbeContainers,
  getDirectPlayMimeType,
  videoIsValidForContainer,
} from "./ffprobe";

export enum StreamTypes {
  DIRECT = "direct",
  MP4 = "mp4",
  MKV = "mkv",
  WEBM = "webm",
}

const TranscodeCodecs = {
  [StreamTypes.MP4]: {
    video: "-c:v libx264",
    audio: "-c:a aac",
  },
  [StreamTypes.WEBM]: {
    video: "-c:v libvpx-vp9",
    audio: "-c:a libopus",
  },
};

function streamTranscode(
  scene: Scene & { path: string },
  req: Request,
  res: Response,
  outputOptions: string[],
  mimeType: string
): void {
  const startQuery = (req.query as { start?: string }).start || "0";
  const startSeconds = Number.parseFloat(startQuery);

  console.log("got start ", startSeconds);

  res.writeHead(200, {
    "Accept-Ranges": "bytes",
    Connection: "keep-alive",
    "Transfer-Encoding": "chunked",
    "Content-Disposition": "inline",
    "Content-Transfer-Enconding": "binary",
    "Content-Type": mimeType,
  });

  // Time out the request after 2mn to prevent accumulating
  // too many ffmpeg processes. After that, the user should reload the page
  req.setTimeout(20 * 1000);

  let command: ffmpeg.FfmpegCommand | null = null;

  console.log(scene.meta.container, scene.meta.videoCodec, scene.meta.audioCodec);
  console.log(">>>", outputOptions);

  command = ffmpeg(scene.path)
    .seek(startSeconds)
    .outputOption(outputOptions)
    // setup event handlers
    .on("start", function (commandLine: string) {
      console.log(`Spawned Ffmpeg with command: ${commandLine}`);
    })
    .on("progress", () => {
      console.log("progress");
    })
    .on("end", function () {
      console.log("file has been converted successfully");
    })
    .on("error", function (err) {
      // Error or stream closed because client request closed
      console.log(`Request finished or an error happened: ${err as string}`);
    });

  command.pipe(res, { end: true });
}

export function streamDirect(
  scene: Scene & { path: string },
  _: Request,
  res: Response
): Response | void {
  const resolved = path.resolve(scene.path);
  return res.sendFile(resolved);
}

export function transcodeWebm(
  scene: Scene & { path: string },
  req: Request,
  res: Response
): Response | void {
  const webmOptions: string[] = [
    "-f webm",
    "-deadline realtime",
    "-cpu-used 5",
    "-row-mt 1",
    "-crf 30",
    "-b:v 0",
  ];
  if (
    scene.meta.videoCodec &&
    videoIsValidForContainer(FFProbeContainers.WEBM, scene.meta.videoCodec)
  ) {
    webmOptions.push("-c:v copy");
  } else {
    webmOptions.push(TranscodeCodecs[StreamTypes.WEBM].video);
  }
  if (
    scene.meta.audioCodec &&
    audioIsValidForContainer(FFProbeContainers.WEBM, scene.meta.audioCodec)
  ) {
    webmOptions.push("-c:a copy");
  } else {
    webmOptions.push(TranscodeCodecs[StreamTypes.WEBM].audio);
  }
  return streamTranscode(
    scene,
    req,
    res,
    webmOptions,
    getDirectPlayMimeType(FFProbeContainers.WEBM)
  );
}

export function transcodeMkv(
  scene: Scene & { path: string },
  req: Request,
  res: Response
): Response | void {
  if (FFProbeContainers.MKV !== scene.meta.container) {
    return res.status(400).send("Scene is not an mkv file");
  }

  const isMP4VideoValid =
    scene.meta.videoCodec && videoIsValidForContainer(FFProbeContainers.MP4, scene.meta.videoCodec);
  const isMP4AudioValid =
    scene.meta.audioCodec && audioIsValidForContainer(FFProbeContainers.MP4, scene.meta.audioCodec);
  console.log("mkv valid ? ", isMP4VideoValid, isMP4AudioValid);

  if (!isMP4VideoValid) {
    return res.status(400).send(`Video codec "${scene.meta.videoCodec}" is not valid for mp4`);
  }
  if (!isMP4AudioValid) {
    return res.status(400).send(`Audio codec "${scene.meta.audioCodec}" is not valid for mp4`);
  }

  const mp4Options = ["-f mp4", "-c:v copy", "-movflags frag_keyframe+empty_moov"];

  mp4Options.push(isMP4AudioValid ? "-c:a copy" : TranscodeCodecs[StreamTypes.MP4].audio);

  return streamTranscode(scene, req, res, mp4Options, getDirectPlayMimeType(FFProbeContainers.MP4));
}
