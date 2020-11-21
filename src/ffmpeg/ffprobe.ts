export enum FFProbeVideoCodecs {
  H264 = "h264",
  H265 = "h265",
  VP8 = "vp8",
  VP9 = "vp9",
  MPEG4 = "mpeg4", // avi
  MPEG1 = "mpeg1video", // mpeg
}

export enum FFProbeAudioCodecs {
  AAC = "aac",
  VORBIS = "vorbis",
  OPUS = "opus",
  MP3 = "mp3",
  MP2 = "mp2", // mpeg
  WMAV2 = "wmav2", // wmv
}

export enum FFProbeContainers {
  MP4 = "mov,mp4,m4a,3gp,3g2,mj2",
  WEBM = "matroska,webm",
  MKV = "matroska",
  // AVI = "avi",
  // MPEG = "mpeg",
  // ASF = "asf", // wmv
}

const CodecCompatMap: Record<
  FFProbeContainers,
  { videoCodecs: FFProbeVideoCodecs[]; audioCodecs: FFProbeAudioCodecs[] }
> = {
  [FFProbeContainers.MP4]: {
    videoCodecs: [FFProbeVideoCodecs.H264, FFProbeVideoCodecs.H265],
    audioCodecs: [FFProbeAudioCodecs.AAC, FFProbeAudioCodecs.MP3, FFProbeAudioCodecs.MP2],
  },
  [FFProbeContainers.WEBM]: {
    videoCodecs: [FFProbeVideoCodecs.VP8, FFProbeVideoCodecs.VP9],
    audioCodecs: [FFProbeAudioCodecs.VORBIS, FFProbeAudioCodecs.OPUS],
  },
  [FFProbeContainers.MKV]: {
    videoCodecs: [
      FFProbeVideoCodecs.H264,
      FFProbeVideoCodecs.H265,
      FFProbeVideoCodecs.VP8,
      FFProbeVideoCodecs.VP9,
    ],
    audioCodecs: [FFProbeAudioCodecs.VORBIS, FFProbeAudioCodecs.OPUS],
  },
};

export const isVideoValid = (
  container: FFProbeContainers,
  videoCodec: FFProbeVideoCodecs
): boolean => CodecCompatMap[container].videoCodecs.includes(videoCodec);

export const isAudioValid = (
  container: FFProbeContainers,
  audioCodec: FFProbeAudioCodecs
): boolean => CodecCompatMap[container].audioCodecs.includes(audioCodec);
