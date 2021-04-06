import fs, { ReadStream } from "fs";
import tmp from "tmp";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/Pick";
import { streamValues } from "stream-json/streamers/StreamValues";

export default (json: string | ReadStream, filter: RegExp | string) => {
  return new Promise((resolve, reject) => {
    let readStream;
    if (typeof json === "string") {
      let tempFile = tmp.fileSync({ postfix: ".json" }).name;
      fs.writeFileSync(tempFile, json);
      readStream = fs.createReadStream(tempFile);
    } else {
      readStream = json;
    }

    let foundData: any = [];

    const pipeline = chain([
      readStream,
      parser(),
      pick({ filter }),
      streamValues(),
      (data: any) => {
        foundData.push(data.value);
        return data;
      },
    ]);

    pipeline.output.on("end", () => resolve(foundData));
    pipeline.output.on("error", (err: Error) => reject(err));
  });
};
