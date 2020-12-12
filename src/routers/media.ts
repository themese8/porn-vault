import { spawnSync } from "child_process";
import { Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import { existsSync } from "fs";
import { EOL } from "os";
import path from "path";

import { getConfig } from "../config";
import Image from "../types/image";
import Scene from "../types/scene";
import * as logger from "../utils/logger";
import { convertToSegments } from "../utils/media";

const router = Router();

router.get("/scene/:scene", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);

  if (scene && scene.path) {
    const resolved = path.resolve(scene.path);
    res.sendFile(resolved);
  } else next(404);
});

router.get("/scene/stream/:scene/playlist.m3u8", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);

  if (scene && scene.path) {
    const resolved = path.resolve(scene.path);

    // fluent-ffmpeg ffprobe does not support custom arguments, that's why need to use regular execSync
    const probeCommand = spawnSync(getConfig().binaries.ffprobe, [
      "-v",
      "error", // Hide debug information
      "-skip_frame",
      "nokey",
      "-show_entries",
      "frame=pkt_pts_time", // List all I frames
      "-show_entries",
      "format=duration",
      "-show_entries",
      "stream=duration,width,height",
      "-select_streams",
      "v", // Video stream only, we're not interested in audio
      "-of",
      "json",
      resolved,
    ]);
    const probeResult = JSON.parse(probeCommand.stdout.toString());

    if (probeResult) {
      const duration =
        parseFloat(probeResult.streams[0].duration) || parseFloat(probeResult.format.duration);

      const rawIFrames = Float64Array.from(
        probeResult.frames
          .map((frame: Record<string, string>) => parseFloat(frame.pkt_pts_time))
          .filter((time: number) => !isNaN(time))
      );

      const breakpoints = convertToSegments(rawIFrames, duration);

      req.app.get("cache").set(req.params.scene + "-breakpoints", breakpoints);

      const segments = new Array((breakpoints.length - 1) * 2);
      for (let i = 1; i < breakpoints.length; i++) {
        segments[i * 2 - 2] = `#EXTINF:${(breakpoints[i] - breakpoints[i - 1]).toFixed(3)}`;
        segments[i * 2 - 1] = `${i.toString(16)}.ts`;
      }
      res.send(
        [
          "#EXTM3U",
          "#EXT-X-PLAYLIST-TYPE:VOD",
          "#EXT-X-TARGETDURATION:4.75",
          "#EXT-X-VERSION:4",
          "#EXT-X-MEDIA-SEQUENCE:0", // I have no idea why this is needed.
          ...segments,
          "#EXT-X-ENDLIST",
        ].join(EOL)
      );
    }
  }
});

router.get("/scene/stream/:scene/:segment.ts", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);

  if (scene && scene.path) {
    const resolved = path.resolve(scene.path);

    const breakpoints: Float64Array = req.app.get("cache").get(`${req.params.scene}-breakpoints`);

    const segmentIndex = parseInt(req.params.segment, 16);

    const startAt = segmentIndex;

    ffmpeg(resolved)
      .withAudioCodec("aac")
      .seek(breakpoints[startAt])
      .duration(breakpoints[startAt + 1] - breakpoints[startAt])
      .on("end", function () {
        logger.log("ffmpeg: segment has been converted successfully");
      })
      .on("error", function (err) {
        logger.log(err);
        next(err);
      })
      .addOption("-c:v", "libx264")
      .addOption("-movflags", "frag_keyframe+empty_moov+faststart")
      .addOption("-preset", "veryfast")
      .addOption("-crf", "18")
      .addOption("-force_key_frames", breakpoints.join(","))
      .addOption("-copyts")
      .addOption("-f", "mpegts")
      .addOption("-output_ts_offset", breakpoints[startAt].toString())
      .pipe(res);
  } else next(404);
});

router.get("/image/path/:path", async (req, res) => {
  const pathParam = (req.query as Record<string, string>).path;
  if (!pathParam) return res.sendStatus(400);

  const img = await Image.getImageByPath(pathParam);

  if (img && img.path) {
    const resolved = path.resolve(img.path);
    if (!existsSync(resolved)) res.redirect("/broken");
    else {
      res.sendFile(resolved);
    }
  } else {
    res.sendStatus(404);
  }
});

router.get("/image/:image", async (req, res) => {
  const image = await Image.getById(req.params.image);

  if (image && image.path) {
    const resolved = path.resolve(image.path);
    if (!existsSync(resolved)) res.redirect("/broken");
    else {
      res.sendFile(resolved);
    }
  } else {
    res.redirect("/broken");
  }
});

router.get("/image/:image/thumbnail", async (req, res) => {
  const image = await Image.getById(req.params.image);

  if (image && image.thumbPath) {
    const resolved = path.resolve(image.thumbPath);
    if (!existsSync(resolved)) {
      res.redirect("/broken");
    } else {
      res.sendFile(resolved);
    }
  } else if (image) {
    const config = getConfig();
    logger.log(`${req.params.image}'s thumbnail does not exist (yet)`);
    res.redirect(`/media/image/${image._id}?password=${config.auth.password}`);
  } else {
    res.redirect("/broken");
  }
});

export default router;
