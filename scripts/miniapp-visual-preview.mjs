import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const resolve = (name) => require.resolve(name, { paths: [path.join(root, 'node_modules/.pnpm/node_modules')] });
const esbuild = require(resolve('esbuild'));
const sass = require(resolve('sass'));
const source = path.join(root, 'apps/miniapp/src');
const output = path.join(root, 'output/miniapp-visual-preview');
await mkdir(output, { recursive: true });
await cp(path.join(source, 'assets'), path.join(output, 'assets'), { recursive: true });
const styles = (await readdir(source, { recursive: true })).filter((file) => file.endsWith('.scss'));
const css = styles
  .map((file) => sass.compile(path.join(source, file)).css)
  .join('\n')
  .replace(/\bpage(?=\s*\{)/g, 'body')
  .replace(/(-?\d*\.?\d+)px\b/g, (_, value) => `${Number(value) / 7.5}vw`)
  .replace(/\bview\b/g, 'div')
  .replace(/\btext\b(?=\s|:|\{|\.|#|>)/g, 'span');
await writeFile(
  path.join(output, 'styles.css'),
  css +
    '\nbody{margin:0}*{box-sizing:border-box}button,input,textarea{font:inherit}button{cursor:pointer}img{display:block}main{padding-bottom:76px}.page{min-height:calc(100vh - 100px)}.preview-label{font:10px/24px sans-serif;text-align:center;display:block;background:#292326;color:white}.preview-picker{position:relative}.preview-picker select{position:absolute;inset:0;opacity:0;width:100%;height:100%;z-index:1}.profile-input{height:auto}.home-tabs{padding-bottom:14px}',
);
await writeFile(
  path.join(output, 'index.html'),
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lumi 实际组件走查</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles.css"><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
);
const context = await esbuild.context({
  entryPoints: [path.join(root, 'tools/miniapp-visual-preview/entry.tsx')],
  bundle: true,
  outfile: path.join(output, 'bundle.js'),
  jsx: 'automatic',
  platform: 'browser',
  nodePaths: [path.join(root, 'node_modules/.pnpm/node_modules')],
  plugins: [
    {
      name: 'preview-only-adapters',
      setup(build) {
        build.onResolve({ filter: /^@tarojs\/(components|taro)$/ }, () => ({
          path: path.join(root, 'tools/miniapp-visual-preview/taro.tsx'),
        }));
        build.onResolve({ filter: /services\/http-client$/ }, () => ({
          path: path.join(root, 'tools/miniapp-visual-preview/http.ts'),
        }));
        build.onLoad({ filter: /\.scss$/ }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
});
const server = await context.serve({ servedir: output, host: '127.0.0.1', port: 4321 });
console.log(`Read-only UI fixtures: http://127.0.0.1:${server.port}/?page=index&state=ready`);
console.log(
  `Pages: ${['index', 'wardrobe', 'try-on', 'account', 'profiles', 'publish', 'post', 'posts', 'generations', 'messages', 'follows', 'privacy'].join(', ')}. States: ready, empty, error, anonymous, long.`,
);
