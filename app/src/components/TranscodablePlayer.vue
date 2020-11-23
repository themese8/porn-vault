<template>
  <video v-on="listeners" v-bind="$attrs" id="video" class="video" ref="video">
    <source
      v-for="streamType in initialStreamTypes"
      :key="streamType.type"
      :src="streamType.url"
      :type="streamType.mime"
    />
  </video>
</template>

<script lang="ts">
import { StreamType, BufferedRange } from "@/types/video";

import { Component, Vue, Prop, Watch } from "vue-property-decorator";

@Component
export default class TranscodablePlayer extends Vue {
  $refs!: {
    video: HTMLVideoElement;
  };

  @Prop({ type: Array, required: true }) streamTypes!: StreamType[];
  @Prop({ type: Number, default: 0 }) start!: number;

  transcodeOffset = 0;
  currentStream: StreamType | undefined;
  buffered = null as any;
  progress = 0;
  didSetStart = false;

  get listeners() {
    return {
      ...this.$listeners,
      loadeddata: (...args: unknown[]) => {
        this.onLoadedMetadata();
        (this.$listeners.loadeddata as (...args: unknown[]) => void)?.(...args);
      },
      timeupdate: (...args: unknown[]) => {
        this.onTimeUpdate();
        (this.$listeners.timeupdate as (...args: unknown[]) => void)?.(...args);
      },
    };
  }

  @Watch("progress")
  onProgressChange(val: number): void {
    this.$emit("progress", val);
  }

  @Watch("bufferedRanges")
  onBufferedRangesChange(val: BufferedRange[]): void {
    this.$emit("buffered", val);
  }

  get initialStreamTypes(): StreamType[] {
    // Get new urls with 'start' param, in case a video
    // needs to be transcoded. That potentially avoids a 'seek' on
    // first render
    return this.streamTypes.map((type) => {
      const updatedUrl = new URL(type.url);
      updatedUrl.searchParams.set("start", this.start.toString());
      return {
        ...type,
        url: updatedUrl.toString(),
      };
    });
  }

  get bufferedRanges(): BufferedRange[] {
    if (!this.buffered) {
      return [];
    }
    const bufferedRanges: BufferedRange[] = [];
    for (let i = 0; i < this.buffered.length; i++) {
      bufferedRanges.push({
        start: this.transcodeOffset + this.buffered.start(i),
        end: this.transcodeOffset + this.buffered.end(i),
      });
    }
    return bufferedRanges;
  }

  onLoadedMetadata(): void {
    const vid = this.getVideo();
    if (vid) {
      this.currentStream = this.streamTypes.find((type) => vid.currentSrc.startsWith(type.url));
    }

      // Seek to initial start
    if (!this.didSetStart) {
      // When transcoding and we seek, 'loadedmetadata' will be retriggered,
      // but we do NOT want to seek to the start position again
      this.seek(this.start);
      this.didSetStart = true;
    }
  }

  onTimeUpdate(): void {
    const vid = this.getVideo();
    if (vid) {
      console.log(
        "time update off",
        this.transcodeOffset,
        "vid time ",
        vid.currentTime,
        " total ",
        vid.currentTime + this.transcodeOffset
      );
      this.progress = this.transcodeOffset + vid.currentTime;
      this.buffered = vid.buffered;
    }
  }

  /**
   * @param time - the time to seek to in seconds
   * @param forceUpdate - seek to the position, even if the video
   * is already at that time
   */
  seek(time: number, forceUpdate = false): void {
    if (time === this.progress && !forceUpdate) {
      return;
    }

    const vid = this.getVideo();
    if (!vid) {
      return;
    }

    console.log(this.transcodeOffset, vid.currentTime, JSON.stringify(this.bufferedRanges));
    console.log("req ", time);

    if (
      !this.currentStream?.transcode ||
      (this.transcodeOffset < time &&
        this.bufferedRanges.find((range) => range.start <= time && range.end >= time))
    ) {
      console.log("no transcode or is buffered, go to ", time - this.transcodeOffset);
      vid.pause();
      vid.currentTime = time - this.transcodeOffset;
    } else {
      console.log("is transcode, restart at ", time);
      vid.pause();
      vid.currentTime = 0;
      const src = new URL(vid.currentSrc);
      src.searchParams.set("start", time.toString());
      vid.src = src.toString();
      this.transcodeOffset = time;
      vid.load();
    }
  }

  getVideo(): HTMLVideoElement | undefined {
    return this.$refs.video;
  }
}
</script>
