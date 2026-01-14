// build.ts
await Bun.build({
  entrypoints: ["./src/app.ts"],
  outdir: "./dist",
  compile: {
    outfile: "./church_finance_api",
    bytecode: true,
  },
  minify: true,
  sourcemap: "linked",
  //external: ["mock-aws-s3", "aws-sdk", "nock"],
})
