# Component Selection

Always verify exact component names and props against the installed `@nutui/nutui-react-taro` version. Use this file for first-pass planning, not as a substitute for docs/types.

## Requirement Mapping

Navigation and page chrome:

- Top title/back area: `NavBar` when available; otherwise Taro custom navigation plus `View`.
- Tabs/category switching: `Tabs`.
- Bottom navigation: `Tabbar` if the app does not already use Taro native `tabBar`.
- Long indexed list: `Elevator` for alphabet/index navigation when supported.
- Breadcrumb-like step state: `Steps`.

Basic layout and data display:

- Settings/profile/order rows: `Cell`, `CellGroup`.
- Cards/product blocks: NutUI `Card` if it matches the version; otherwise compose `View`, `Image`, `Price`, `Tag`, `Button`.
- Empty state: `Empty`.
- Loading placeholder: `Skeleton`.
- Images: Taro `Image` for simple usage; NutUI image component only if the version exposes features needed by the design.
- Price display: `Price` when e-commerce price formatting is needed.
- Tags/badges: `Tag`, `Badge`.
- Countdown/promo timer: `CountDown`.

Forms:

- Text input: `Input`.
- Multi-line text: `Textarea`.
- Form layout/validation: `Form` when the version supports the needed validation model; otherwise local state plus validation functions.
- Number changes: `InputNumber` or `Stepper`.
- Single/multiple choice: `Radio`, `RadioGroup`, `Checkbox`, `CheckboxGroup`.
- Boolean: `Switch`.
- Rating: `Rate`.
- Slider/range: `Range` or `Slider`, depending on installed exports.
- Date/time: `Calendar`, `DatePicker`, `TimeSelect`, or `Picker` after verifying exact availability.
- Upload: `Uploader`; confirm mini-program file API behavior.
- Search: `SearchBar`.

Feedback and overlays:

- Lightweight message: `Toast` or `Taro.showToast`; prefer the established project pattern.
- Confirmation: `Dialog` or `Taro.showModal`; prefer `Taro.showModal` for simple native confirmation.
- Bottom sheet / filter panel: `Popup`.
- Mask layer: `Overlay`.
- Dropdown actions: `Popover` or `Menu`; verify mini-program support.
- Notice strip: `NoticeBar`.
- Progress: `Progress`.
- Swipe actions: `SwipeCell`.
- Pull-to-refresh: `PullToRefresh` if present and compatible with the target platform.

Commerce/business:

- Product card/list: `Card`, `Price`, `Tag`, `Button`, `Image`, plus `Skeleton` and `Empty`.
- Cart quantity: `InputNumber` or `Stepper`.
- SKU selection: `Sku` if present; otherwise compose `Popup`, `Cell`, `Tag`, `Button`.
- Address selection: `Address`, `Cascader`, `Picker`, or custom `Popup` depending on version.
- Coupon/promo: `Coupon` if present; otherwise compose.

## Planning Template

For each user requirement, produce:

```text
需求: ...
组件: ...
状态: ...
事件: ...
接口/数据: ...
小程序注意点: ...
需要查证: component props / icon names / platform support
```

## Selection Heuristics

- Prefer fewer NutUI components when Taro primitives are enough; this reduces bundle and styling surprises.
- Use NutUI for interaction-heavy controls, form controls, overlays, feedback, and business widgets.
- Use Taro primitives for custom layout, simple text/image blocks, and project-specific compositions.
- Do not force a NutUI component if the design requires behavior that is easier and safer as a local component.
- When choosing between native Taro feedback and NutUI feedback, follow the project's existing UX consistency.

