import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageMimeType } from '../src/features/media/image-file';

test('image upload MIME inference accepts supported extensions case-insensitively', () => {
  assert.equal(imageMimeType('/tmp/look.JPG'), 'image/jpeg');
  assert.equal(imageMimeType('/tmp/look.png?temporary=1'), 'image/png');
  assert.equal(imageMimeType('/tmp/look.WEBP'), 'image/webp');
});

test('image upload MIME inference rejects unknown or missing extensions', () => {
  assert.throws(() => imageMimeType('/tmp/look.heic'), /仅支持 JPG、PNG 或 WebP/);
  assert.throws(() => imageMimeType('/tmp/look'), /仅支持 JPG、PNG 或 WebP/);
});
