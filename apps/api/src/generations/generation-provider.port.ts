export const GENERATION_PROVIDER = Symbol('GENERATION_PROVIDER');

export type GenerateImageCommand = {
  jobId: string;
  userId: string;
  profileVersionId: string;
  clothingAssetId: string;
  inputSnapshot?: unknown;
  signal?: AbortSignal;
};

export type GeneratedAsset = {
  objectKey: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  previewData: string | null;
};

export interface GenerationProvider {
  generate(command: GenerateImageCommand): Promise<GeneratedAsset>;
}
