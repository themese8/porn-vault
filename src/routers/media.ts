import { Router } from "express";
import { existsSync } from "fs";
import path from "path";

import { getConfig } from "../config";
import Image from "../types/image";
import Scene from "../types/scene";
import * as logger from "../utils/logger";

import ffmpeg from "fluent-ffmpeg";

const router = Router();

router.get("/scene/:scene", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);

  if (scene && scene.path) {
    const resolved = path.resolve(scene.path);
    res.sendFile(resolved);
  } else next(404);
});

router.get("/scene/stream/:scene", async (req, res, next) => {
  const scene = await Scene.getById(req.params.scene);

  console.log(req.headers);

  if (scene && scene.path) {
    const resolved = path.resolve(scene.path);

    res.setHeader("Content-Type", "video/mp4");

    let seek = 0;

    if (typeof req.query.seek !== "undefined") {
      seek = parseInt(req.query.seek);
    }

    ffmpeg(resolved)
      .withAudioCodec("aac")
      .toFormat("mp4")
      .seek(seek)
      .on("end", function () {
        logger.log("ffmpeg: file has been converted successfully");
      })
      .on("error", function (err) {
        logger.log(err);
        next(err);
      })
      .addOption("-movflags", "frag_keyframe+empty_moov+faststart")
      .addOption("-preset", "veryfast")
      .addOption("-crf", "18")
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
