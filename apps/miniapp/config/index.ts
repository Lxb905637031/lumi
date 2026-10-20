import { defineConfig, type UserConfigExport } from '@tarojs/cli';

const config: UserConfigExport = defineConfig({
  projectName: 'lumi-miniapp',
  date: '2026-10-18',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'react',
  compiler: 'webpack5',
  copy: { patterns: [{ from: 'src/assets/icons', to: 'dist/assets/icons' }], options: {} },
  // Taro replaces configured env values at build time. Keeping this value out
  // of the runtime bundle is required because the WeChat JS runtime has no
  // Node.js `process` global.
  env: {
    TARO_APP_API_BASE_URL: JSON.stringify(process.env.TARO_APP_API_BASE_URL ?? 'http://127.0.0.1:4300/api/v1'),
  },
  mini: {
    postcss: {
      pxtransform: { enable: true },
      autoprefixer: { enable: true },
    },
  },
});

export default config;
