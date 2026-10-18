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
  mini: {
    postcss: {
      pxtransform: { enable: true },
      autoprefixer: { enable: true },
    },
  },
});

export default config;
