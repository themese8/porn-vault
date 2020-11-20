import { Router } from "express";
import ffmpeg from "fluent-ffmpeg";
import { existsSync } from "fs";
import path from "path";

import { getConfig } from "../config";
import Image from "../types/image";
import Scene from "../types/scene";
import * as logger from "../utils/logger";

const router = Router();

const CONVERT_TIMEOUT = 5 * 1000;

router.get("/scene/:scene/:type", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);
  if (!scene || !scene.path) {
    return next(404);
  }

  if (req.params.type === "mp4" && scene.path.includes(".mp4")) {
    const resolved = path.resolve(scene.path);
    res.sendFile(resolved);
  } else if (req.params.type === "webm") {
    const startQuery = (req.query as { start?: string }).start || "0";
    const startSeconds = Number.parseFloat(startQuery);

    console.log("got start ", startSeconds);

    res.writeHead(200, {
      "Accept-Ranges": "bytes",
      Connection: "keep-alive",
      // "Keep-Alive": `timeout=${CONVERT_TIMEOUT / 1000}`,
      "Transfer-Encoding": "chunked",
      "Content-Disposition": "inline",
      "Content-Transfer-Enconding": "binary",
      "Content-Type": "video/webm",
    });

    let command: ffmpeg.FfmpegCommand | null = null;
    let killTimeout: NodeJS.Timeout;
    let killed = false;

    const killCommand = (reason: string) => {
      if (command && !killed) {
        killed = true;

        clearTimeout(killTimeout);
        console.log(`kill ${reason}`);
        command.kill("SIGKILL");
        res.end();
      }
    };
    const startCommandTimeout = () =>
      (killTimeout = setTimeout(() => killCommand("timed out"), CONVERT_TIMEOUT));

    command = ffmpeg(scene.path)
      .seek(startSeconds)
      .outputOption([
        "-f webm",
        "-c:v libvpx-vp9",
        "-deadline realtime",
        "-cpu-used 5",
        "-row-mt 1",
        "-crf 30",
        "-b:v 0",
      ])
      // setup event handlers
      .on("start", function (commandLine: string) {
        console.log(`Spawned Ffmpeg with command: ${commandLine}`);
      })
      .on("progress", () => {
        console.log("progress");
        clearTimeout(killTimeout);
        startCommandTimeout();
      })
      .on("end", function () {
        console.log("file has been converted succesfully");
        killCommand(">>end conversion");
      })
      .on("error", function (err) {
        console.log(`an error happened: ${err as string}`);
        killCommand(">>error");
      });

    command.pipe(res, { end: true });

    startCommandTimeout();

    res.on("end", () => {
      killCommand(">>>RES END");
    });
  } else {
    res.sendStatus(400);
  }
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
