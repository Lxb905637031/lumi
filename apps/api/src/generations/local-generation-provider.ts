import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GenerateImageCommand, GeneratedAsset, GenerationProvider } from './generation-provider.port';

/**
 * A deterministic, local-only provider for zero-budget development and CI.
 * Production must replace this adapter with a provider backed by private object storage and a model API.
 */
@Injectable()
export class LocalGenerationProvider implements GenerationProvider {
  async generate(command: GenerateImageCommand): Promise<GeneratedAsset> {
    const previewData = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">',
      '<rect width="720" height="960" fill="#f5f0e9"/>',
      '<rect x="72" y="72" width="576" height="816" rx="24" fill="#d96f58" opacity="0.9"/>',
      '<circle cx="360" cy="300" r="92" fill="#f7d5bd"/>',
      '<path d="M218 760c12-176 74-278 142-278s130 102 142 278" fill="#2f3437"/>',
      `<text x="360" y="840" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#fff">Lumi local preview ${command.jobId}</text>`,
      '</svg>',
    ].join('');
    const encodedPreview = `data:image/svg+xml;base64,${Buffer.from(previewData, 'utf8').toString('base64')}`;
    const bytes = Buffer.byteLength(previewData, 'utf8');

    return {
      objectKey: `local/generations/${command.jobId}.svg`,
      mimeType: 'image/svg+xml',
      byteSize: bytes,
      sha256: createHash('sha256').update(previewData).digest('hex'),
      previewData: encodedPreview,
    };
  }
}
