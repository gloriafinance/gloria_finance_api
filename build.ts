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
  external: ["@bull-board/api", "@bull-board/bun", "@bull-board/ui"],
})
