#!/usr/bin/env node

const { execFileSync } = require('node:child_process')

const packages = [
  '@nutui/nutui-react-taro',
  '@nutui/icons-react-taro',
  '@tarojs/taro',
  '@tarojs/components',
  '@tarojs/plugin-html',
]

const useShell = process.platform === 'win32'

function npmView(pkg) {
  const output = execFileSync(
    'npm',
    ['view', pkg, 'version', 'dist-tags', 'repository', 'homepage', 'bugs', '--json'],
    { encoding: 'utf8', shell: useShell, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  return JSON.parse(output)
}

const result = {
  checkedAt: new Date().toISOString(),
  packages: {},
}

for (const pkg of packages) {
  try {
    result.packages[pkg] = npmView(pkg)
  } catch (error) {
    result.packages[pkg] = {
      error: error.message,
      stderr: error.stderr ? String(error.stderr).trim() : undefined,
    }
  }
}

console.log(JSON.stringify(result, null, 2))
