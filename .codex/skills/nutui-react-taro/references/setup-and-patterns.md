# Setup And Patterns

## Version And Install Policy

First inspect the project:

```bash
Get-Content package.json
rg -n "@nutui/nutui-react-taro|@nutui/icons-react-taro|@tarojs/" package.json pnpm-lock.yaml package-lock.json yarn.lock
```

If NutUI is absent and the user wants React + Taro mini-program UI, install the React Taro package, not the Vue package:

```bash
npm i @nutui/nutui-react-taro
npm i @nutui/icons-react-taro
```

Use the repo's package manager if obvious (`pnpm-lock.yaml` -> `pnpm`, `yarn.lock` -> `yarn`, `package-lock.json` -> `npm`).

Do not use `@nutui/nutui-taro` for React projects; that package is for the Vue/Taro line.

## Typical Imports

Verify exact exports against the installed version, then use this shape:

```tsx
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button, Cell, Form, Input, Popup, Toast } from '@nutui/nutui-react-taro'
import { Search } from '@nutui/icons-react-taro'
import '@nutui/nutui-react-taro/dist/style.css'
```

If the local project already has a global NutUI stylesheet import in `src/app.tsx` or `src/app.ts`, do not duplicate it in pages.

## Taro Config

Check `config/index.ts`, `config/index.js`, and project docs before editing. NutUI/Taro setups often need:

- `designWidth: 375` when matching NutUI mobile design assumptions.
- `@tarojs/plugin-html` if the installed NutUI version or docs require HTML element support.
- SCSS/theme variable config only if the project actually uses SCSS theme overrides.

Do not add `@tarojs/plugin-html` blindly. Verify the installed NutUI version and existing config first.

## Page Pattern

```tsx
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button, Cell, Input, Popup } from '@nutui/nutui-react-taro'

export default function ExamplePage() {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)

  const handleSubmit = () => {
    if (!keyword.trim()) {
      Taro.showToast({ title: '请输入关键词', icon: 'none' })
      return
    }
    setOpen(true)
  }

  return (
    <View className='page'>
      <Cell title='搜索条件' description='按关键词筛选' />
      <Input
        value={keyword}
        placeholder='请输入'
        onChange={(value) => setKeyword(String(value))}
      />
      <Button type='primary' block onClick={handleSubmit}>
        查询
      </Button>
      <Popup visible={open} onClose={() => setOpen(false)} position='bottom'>
        <View className='result-panel'>
          <Text>{keyword}</Text>
        </View>
      </Popup>
    </View>
  )
}
```

The `Input` event shape can differ by version. Before finalizing code, verify whether the installed version's `Input` uses `onChange={(value) => ...}`, `onChange={(value, event) => ...}`, or a Taro-style event. Adjust code to the installed type declarations.

## Mini-Program Guardrails

- Use `View` and `Text`, not `div` and `span`.
- Do not use `window`, `document`, `localStorage`, `location`, `alert`, or `confirm`.
- Convert storage to `Taro.setStorageSync` / `Taro.getStorageSync`.
- Convert network calls to the project's request wrapper or `Taro.request`.
- Convert navigation to Taro APIs.
- Pre-compute filtered/sorted arrays before JSX when mini-program compilation complains about expressions.
- Avoid nesting block layout inside `Text`.
- Prefer fixed bottom action bars with safe-area padding.

## Verification

Run the narrowest available command:

```bash
npm run typecheck
npm run lint
npm run build:weapp
npm run dev:weapp
taro build --type weapp
```

If no scripts exist, at least run TypeScript or the package manager install check. Report any command that could not be run.

