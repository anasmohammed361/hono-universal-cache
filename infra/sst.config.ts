/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "infra",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    const bucket = new sst.aws.Bucket("turborepo-remote-cache-bucket");
    return {
      bucketName: bucket.name,
      s3Endpoint: bucket.domain,
      region: bucket.nodes.bucket.region,
    }
  },
});
