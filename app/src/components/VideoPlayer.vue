<template>
  <div class="plyr-container">
      <video
        id="video"
        class="video"
        ref="video"
        :data-poster="poster"
      >
        <source :src="src" type="video/mp4" />
      </video>
      <v-fade-transition>
        <div v-if="videoNotice" class="notice pa-2">{{ videoNotice }}</div>
      </v-fade-transition>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

import Plyr from "plyr";
import Hls from "hls.js";

@Component
export default class VideoPlayer extends Vue {
  @Prop(String) src!: string;
  @Prop(Number) duration!: number;
  @Prop({ default: null }) poster!: string | null;
  @Prop() markers!: { _id: string; name: string; time: number }[];
  @Prop({ default: null }) preview!: string | null;

  videoNotice = "";
  noticeTimeout: null | number = null;

  plyr = null as any;

  paniced = false;

  mounted() {
    const vid = <HTMLVideoElement>this.$refs.video;

    this.plyr = new Plyr(vid, {
      duration: this.duration
    });

    const hls = new Hls();
    hls.loadSource(this.src);
    hls.attachMedia(vid);

  }

  notice(text: string, duration = 1500) {
    console.log(text, duration);
    if (this.noticeTimeout) {
      clearTimeout(this.noticeTimeout);
    }
    this.videoNotice = text;
    this.noticeTimeout = window.setTimeout(() => {
      this.videoNotice = "";
    }, duration);
  }

  panic() {
    this.paniced = true;
    this.plyr.pause();
    const vid = <HTMLVideoElement>this.$refs.video;
    if (vid) {
      vid.src = "";
    }
    window.location.replace(localStorage.getItem("pm_panic") || "https://google.com");
  }

}
</script>

<style lang="scss" scoped>

@import "../../node_modules/plyr/dist/plyr.css";

.notice {
  background: #333333aa;
  position: absolute;
  left: 10px;
  top: 10px;
  border-radius: 6px;
}

</style>
