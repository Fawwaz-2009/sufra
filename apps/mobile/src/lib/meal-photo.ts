import * as ImageManipulator from 'expo-image-manipulator';
import type * as ImagePicker from 'expo-image-picker';

import { Photo } from '@sufra-web/worker/models/meal.ts';

const MAX_WIDTHS = [1600, 1280, 1024, 768] as const;
const COMPRESSIONS = [0.82, 0.72, 0.62, 0.52, 0.42] as const;

export interface PreparedMealPhoto {
  readonly filename: string;
  readonly data: Uint8Array;
}

export async function prepareMealPhoto(asset: ImagePicker.ImagePickerAsset): Promise<PreparedMealPhoto> {
  for (const width of MAX_WIDTHS) {
    for (const compress of COMPRESSIONS) {
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(width, asset.width || width) } }],
        { compress, format: ImageManipulator.SaveFormat.JPEG }
      );
      const data = await uriToBytes(manipulated.uri);
      if (data.byteLength <= Photo.maxBytes) {
        return { filename: filenameFor(asset.uri), data };
      }
    }
  }

  throw new Error('That photo is too large. Try another angle or pick a different photo.');
}

async function uriToBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

function filenameFor(uri: string): string {
  const tail = uri.split('/').pop()?.split('?')[0];
  const base = tail && tail.length > 0 ? tail : `meal-${Date.now()}`;
  return base.toLowerCase().endsWith('.jpg') || base.toLowerCase().endsWith('.jpeg')
    ? base
    : `${base}.jpg`;
}
