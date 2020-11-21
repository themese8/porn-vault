import Actor from "../../types/actor";
import CustomField, { CustomFieldTarget } from "../../types/custom_field";
import Image from "../../types/image";
import Label from "../../types/label";
import Marker from "../../types/marker";
import Movie from "../../types/movie";
import Scene from "../../types/scene";
import Studio from "../../types/studio";
import SceneView from "../../types/watch";
import { StreamTypes } from "./../../ffmpeg/stream";

interface StreamType {
  label: string;
  mime: string;
  type: string;
  transcode: boolean;
}

export default {
  async actors(scene: Scene): Promise<Actor[]> {
    return await Scene.getActors(scene);
  },
  async images(scene: Scene): Promise<Image[]> {
    return await Image.getByScene(scene._id);
  },
  async labels(scene: Scene): Promise<Label[]> {
    return await Scene.getLabels(scene);
  },
  async thumbnail(scene: Scene): Promise<Image | null> {
    if (scene.thumbnail) return await Image.getById(scene.thumbnail);
    return null;
  },
  async preview(scene: Scene): Promise<Image | null> {
    if (scene.preview) return await Image.getById(scene.preview);
    return null;
  },
  async studio(scene: Scene): Promise<Studio | null> {
    if (scene.studio) return Studio.getById(scene.studio);
    return null;
  },
  async markers(scene: Scene): Promise<Marker[]> {
    return await Scene.getMarkers(scene);
  },
  async availableFields(): Promise<CustomField[]> {
    const fields = await CustomField.getAll();
    return fields.filter((field) => field.target.includes(CustomFieldTarget.SCENES));
  },
  async movies(scene: Scene): Promise<Movie[]> {
    return Scene.getMovies(scene);
  },
  async watches(scene: Scene): Promise<number[]> {
    return (await SceneView.getByScene(scene._id)).map((v) => v.date);
  },
  streamResolutions(scene: Scene): { label: string; width: number; height: number }[] {
    // TODO:
    return [
      {
        label: "original resolution",
        width: -1,
        height: -1,
      },
    ];
  },
  streamTypes(scene: Scene): StreamType[] {
    // TODO: extract from ffprobe metadata, generate streams according
    // to current file codecs

    const streams: StreamType[] = [];
    console.log(scene.path);

    if (scene.path?.endsWith(".mp4")) {
      streams.unshift({
        label: "direct stream",
        mime: "video/mp4",
        type: StreamTypes.DIRECT,
        transcode: false,
      });
    }
    if (scene.path?.endsWith(".webm")) {
      streams.unshift({
        label: "direct stream",
        mime: "video/webm",
        type: StreamTypes.DIRECT,
        transcode: false,
      });
    }
    // Otherwise needs to be transcoded
    if (scene.path?.endsWith(".mkv")) {
      streams.push({
        label: "mkv transcode",
        mime: "video/mp4",
        type: StreamTypes.MKV,
        transcode: true,
      });
    }
    streams.push({
      label: "webm transcode",
      mime: "video/webm",
      type: StreamTypes.WEBM,
      transcode: true,
    });

    console.log(JSON.stringify(streams, null, 2));

    return streams;
  },
};
