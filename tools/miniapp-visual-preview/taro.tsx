import React, { useEffect } from 'react';

// Browser-only adapters. Never imported by the weapp build.
export const View = ({ children, ...props }) => <div {...props}>{children}</div>;
export const Text = ({ children, ...props }) => <span {...props}>{children}</span>;
export const Image = ({ mode, lazyLoad, ...props }) => (
  <img
    {...props}
    alt=""
    loading={lazyLoad ? 'lazy' : 'eager'}
    style={{
      objectFit: mode === 'aspectFit' ? 'contain' : 'cover',
      ...(mode === 'widthFix' ? { height: 'auto' } : {}),
    }}
  />
);
export const Button = ({ children, loading, ...props }) => <button {...props}>{loading ? '处理中…' : children}</button>;
export const Input = ({ onInput, maxlength, type, ...props }) => (
  <input
    {...props}
    type={type === 'number' ? 'number' : 'text'}
    maxLength={maxlength}
    onChange={(e) => onInput?.({ detail: { value: e.target.value } })}
  />
);
export const Textarea = ({ onInput, maxlength, ...props }) => (
  <textarea {...props} maxLength={maxlength} onChange={(e) => onInput?.({ detail: { value: e.target.value } })} />
);
export const Picker = ({ children, range, value, onChange, disabled }) => (
  <div className="preview-picker">
    <select
      aria-label="选择人物档案"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange({ detail: { value: e.target.value } })}
    >
      {range.map((item, i) => (
        <option key={i} value={i}>
          {item}
        </option>
      ))}
    </select>
    {children}
  </div>
);
export function useDidShow(callback) {
  useEffect(() => {
    callback();
  }, []);
}
export function useDidHide() {}
export function useRouter() {
  return { params: { id: 'sample', collection: new URLSearchParams(location.search).get('collection') } };
}
const navigate = ({ url }) => {
  const route = url.split('/')[2];
  location.href = `?page=${route}&state=${new URLSearchParams(location.search).get('state') || 'ready'}`;
  return Promise.resolve();
};
const taro = {
  navigateTo: navigate,
  switchTab: navigate,
  redirectTo: navigate,
  reLaunch: navigate,
  showModal: async () => ({ confirm: false }),
  showToast: async () => undefined,
  getStorageSync: () => '',
  setStorageSync: () => undefined,
  previewImage: async () => undefined,
  chooseImage: async () => {
    throw new Error('组件预览不访问相册，请在微信中验收上传');
  },
};
export default taro;
