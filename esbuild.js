const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: false,
  logLevel: 'info'
};

async function build() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('build complete: dist/extension.js');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
