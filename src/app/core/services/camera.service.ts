import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';

/**
 * Camera wrapper. Returns base64-encoded JPEGs suitable for
 * DevicePostDto.image (evacuation receipts, incident photos).
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  /**
   * Capture a single photo. Returns base64 string WITHOUT the
   * `data:image/jpeg;base64,` prefix — ready to send as the `image` field.
   */
  async capture(options?: { quality?: number }): Promise<string> {
    const photo: Photo = await Camera.getPhoto({
      quality: options?.quality ?? 70,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!photo.base64String) {
      throw new Error('No image data returned');
    }
    return photo.base64String;
  }

  /** Same as capture but allows picking from library — used in dev/testing. */
  async pickFromLibrary(options?: { quality?: number }): Promise<string> {
    const photo: Photo = await Camera.getPhoto({
      quality: options?.quality ?? 70,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
      correctOrientation: true,
    });
    if (!photo.base64String) {
      throw new Error('No image data returned');
    }
    return photo.base64String;
  }
}
