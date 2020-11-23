export interface StreamType {
  label: string;
  mime: string;
  type: string;
  transcode: boolean;
  url: string;
}

export interface BufferedRange {
  start: number;
  end: number;
}
