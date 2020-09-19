import { trailerCollection } from "../database";
import { generateHash } from "../hash";

export default class Trailer {
  _id: string;
  scene: string | null = null;
  path: string | null = null;
  name: string | null = null;

  static async getById(_id: string): Promise<Trailer | null> {
    return trailerCollection.get(_id);
  }

  static async getByScene(id: string): Promise<Trailer[]> {
    return trailerCollection.query("scene-index", id);
  }

  constructor(name: string) {
    this._id = "tr_" + generateHash();
    this.name = name;
  }
}
