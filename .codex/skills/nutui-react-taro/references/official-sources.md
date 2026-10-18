# Official Sources

Use these sources before making claims about the latest NutUI React Taro behavior:

- NutUI React site: https://nutui.jd.com/react/
- NutUI React GitHub: https://github.com/jdf2e/nutui-react
- NutUI React releases: https://github.com/jdf2e/nutui-react/releases
- npm package: https://www.npmjs.com/package/@nutui/nutui-react-taro
- Taro docs: https://docs.taro.zone/
- Taro NutUI integration doc: https://docs.taro.zone/docs/nutui/

## Current Snapshot From 2026-06-09

Do not treat this as permanent truth; re-run the version script.

- `npm view @nutui/nutui-react-taro version` returned `3.1.0-beta.1`.
- `npm view @nutui/nutui-react-taro dist-tags` showed `latest: 3.1.0-beta.1` and `beta: 3.1.0-beta.2`.
- GitHub releases showed `v4.0.0-beta.2` on 2026-06-08 and `v3.1.0-beta.2` on 2026-06-08.
- `npm view @tarojs/taro version` returned `4.2.0`.

This means npm dist-tags, GitHub releases, docs routes, and local project versions may disagree. Resolve conflicts in this order:

1. Existing project dependencies and lockfile.
2. The version the user explicitly requested.
3. npm package metadata for installable package versions.
4. GitHub release notes/changelog for upcoming or beta behavior.
5. Docs/examples matching the same major version.

## Useful Commands

```bash
npm view @nutui/nutui-react-taro version dist-tags repository homepage bugs --json
npm view @nutui/icons-react-taro version dist-tags --json
npm view @tarojs/taro version dist-tags --json
npm view @tarojs/components version dist-tags --json
npm view @tarojs/plugin-html version dist-tags --json
```

For exact component exports and types:

```bash
npm pack @nutui/nutui-react-taro@<version> --dry-run
npm pack @nutui/nutui-react-taro@<version>
```

Unpack to a temporary directory and inspect `.d.ts`, `dist`, `es`, examples, or package metadata. Remove temporary tarballs after inspection unless they are needed for the task.

