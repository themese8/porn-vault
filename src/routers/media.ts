import { Router } from "express";
import { existsSync } from "fs";
import path from "path";

import { getConfig } from "../config";
import { streamDirect, StreamTypes, transcodeMkv, transcodeWebm } from "../ffmpeg/stream";
import Image from "../types/image";
import Scene from "../types/scene";
import * as logger from "../utils/logger";

const router = Router();

router.get("/scene/:scene/:type", async (req, res, next) => {
  const sc = await Scene.getById(req.params.scene);
  if (!sc || !sc.path) {
    return next(404);
  }
  const scene = sc as Scene & { path: string };

  const streamType = req.params.type as StreamTypes | null;
  console.log("req streamType", streamType);

  switch (streamType) {
    case StreamTypes.DIRECT:
      return streamDirect(scene, req, res);
    case StreamTypes.WEBM:
      return transcodeWebm(scene, req, res);
    case StreamTypes.MKV:
      return transcodeMkv(scene, req, res);
    default:
      return res.sendStatus(400);
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
