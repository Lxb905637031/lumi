---
name: nutui-react-taro
description: Build, review, migrate, and troubleshoot Taro React mini-program pages using @nutui/nutui-react-taro. Use when the user mentions NutUI, NutUI React, NutUI Taro, @nutui/nutui-react-taro, Taro React mini-program UI, component selection from requirements, page generation, form/list/detail/order/cart/business mobile pages, theme/style setup, icons, package/version compatibility, or asks how to write current NutUI React Taro component code.
---

# NutUI React Taro

## Core Rule

Treat NutUI React Taro as a fast-moving dependency. Before giving version-specific advice, installing packages, changing imports, or using a component prop you are not already seeing in the local codebase, verify the current project and current upstream state.

Run this first when version accuracy matters:

```bash
node scripts/check-current-packages.js
```

Then inspect the user's project:

```bash
rg -n "@nutui/nutui-react-taro|@nutui/icons-react-taro|@tarojs/taro|@tarojs/components|@tarojs/plugin-html" package.json src config
```

Prefer the project's installed major/minor version over npm latest unless the user explicitly asks to upgrade.

## Workflow

1. Confirm target: usually Taro React + TypeScript + WeChat mini program (`weapp`). If H5/JD/Harmony is also required, call that out.
2. Verify versions and docs using `scripts/check-current-packages.js`, `package.json`, lockfiles, and official sources.
3. Translate the user's need into a component plan. Load `references/component-selection.md` for mapping common product requirements to NutUI components.
4. Load `references/setup-and-patterns.md` before adding dependencies, config, global styles, themes, icons, or Taro-specific code patterns.
5. Implement with Taro primitives (`View`, `Text`, `Image`, `ScrollView`, etc.) plus NutUI components. Avoid DOM APIs, browser-only events, and raw HTML elements in mini-program code.
6. Verify by running the repo's typecheck/lint/build command when available. For UI work, prefer the target mini-program build command (often `npm run dev:weapp`, `pnpm dev:weapp`, or `taro build --type weapp`).

## Component Planning

When the user describes a page or interaction, respond first with a terse component plan unless they asked for code only:

- Page structure: Taro layout primitives and custom sections.
- NutUI candidates: exact components and why they fit.
- State and events: controlled inputs, popup visibility, form validation, list loading, navigation.
- Platform caveats: mini-program constraints, CSS/rpx, safe area, scroll behavior.

Before using an unfamiliar component, search official docs or repo examples by component name. If docs are JavaScript-rendered and hard to scrape, use npm package files, GitHub source, examples, and type declarations as the source of truth.

## Code Standards

- Use TypeScript and functional React components.
- Import platform primitives from `@tarojs/components`.
- Import Taro APIs from `@tarojs/taro`.
- Import NutUI React Taro components from `@nutui/nutui-react-taro`.
- Import icons from `@nutui/icons-react-taro` only after verifying the icon exists.
- Keep NutUI props version-accurate. Do not invent prop names.
- Use `e.detail.value` for Taro inputs and NutUI events when the component API says so; never assume browser `e.target.value`.
- Use `Taro.showToast`, `Taro.showModal`, `Taro.navigateTo`, `Taro.redirectTo`, `Taro.switchTab`, and `Taro.navigateBack` instead of browser APIs.
- Prefer `null` over `undefined` for mini-program state that is rendered.
- Keep styles mini-program friendly: `rpx`, class names, SCSS/CSS supported by the repo, and safe-area handling for fixed bottoms.

## References

- `references/setup-and-patterns.md`: install/config/theme/import/version workflow and code patterns.
- `references/component-selection.md`: requirement-to-component mapping and composition heuristics.
- `references/official-sources.md`: official URLs and how to query current docs/releases.
