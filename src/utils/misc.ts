import { createReadStream, PathLike } from "fs";
import * as path from "path";

import { getConfig } from "../config";
import { existsAsync } from "./fs/async";
import * as logger from "./logger";
import { isNumber } from "./types";

export function validRating(val: unknown): val is number {
  return isNumber(val) && val >= 0 && val <= 10 && Number.isInteger(val);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createObjectSet<T extends Record<string, any>>(
  objs: T[],
  key: keyof T & string
): T[] {
  const dict = {} as { [key: string]: T };
  for (const obj of objs) {
    dict[obj[key]] = obj;
  }
  const set = [] as T[];
  for (const key in dict) {
    set.push(dict[key]);
  }
  return set;
}

export function isValidUrl(str: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(str);
    return true;
  } catch (err) {
    logger.error(err);
    return false;
  }
}

export function libraryPath(str: string): string {
  return path.join(getConfig().persistence.libraryPath, "library", str);
}

/**
 * Generates an array of timestamps at regular intervals
 *
 * @param count - the amount of timestamps to generate
 * @param duration - the duration of the media. If given, will generate timestamps in seconds
 * based on this duration. Otherwise, will generate in percentage strings
 * @param options - generation options
 * @param options.startPercentage - where to start the timestamp generation, as a percentage
 * @param options.endPercentage - where to stop the timestamp generation, as a percentage
 */
export function generateTimestampsAtIntervals(
  count: number,
  duration: number | null = null,
  options: { startPercentage: number; endPercentage: number } = {
    startPercentage: 0,
    endPercentage: 100,
  }
): string[] {
  const timestamps: string[] = [];

  let startPosition: number;
  let endPosition: number;

  if (duration) {
    const secondsPerPercent = duration / 100;
    startPosition = secondsPerPercent * options.startPercentage;
    endPosition = secondsPerPercent * options.endPercentage;
  } else {
    startPosition = options.startPercentage;
    endPosition = options.endPercentage;
  }

  const interval = (endPosition - startPosition) / count;

  for (let i = 0; i < count; i++) {
    timestamps.push(`${startPosition + interval * i}${duration ? "" : "%"}`);
  }

  return timestamps;
}

/**
 * Reads the first n bytes of the file into a buffer
 * https://stackoverflow.com/a/59722384/13599482
 *
 * @param filepath - path to the file to read
 * @param n - how many bytes to read
 */
export async function readFirstNBytes(filepath: PathLike, n: number): Promise<Buffer | null> {
  if (!(await existsAsync(filepath))) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of createReadStream(filepath, { start: 0, end: n })) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
