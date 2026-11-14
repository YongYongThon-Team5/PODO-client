/*
 * 올리기 전에 큰 사진을 줄인다.
 * 휴대폰 사진은 한 장에 3~8MB라, 3장을 한 번에 보내면 배포 프록시(Vercel)의 요청 크기 한도나
 * 서버 한도(장당 5MB)를 넘을 수 있다. 긴 변 2048px·JPEG로 줄이면 안내판 글자는 읽히면서 장당 1MB 안쪽이 된다.
 */
const MAX_SIDE = 2048;
/** 장당 목표 크기. 3장을 보내도 합쳐서 4MB 안쪽이 되게 한다 */
const TARGET_BYTES = 1.3 * 1024 * 1024;
/** 목표보다 크면 화질을 한 단계씩 낮춰 다시 만든다 */
const QUALITIES = [0.85, 0.7, 0.55];
/** 이보다 작으면 그대로 보낸다 */
const KEEP_BYTES = 1024 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= KEEP_BYTES || !file.type.startsWith('image/')) return file;
  try {
    // 휴대폰 세로 사진이 눕지 않게 EXIF 방향을 반영해 읽는다
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    let blob: Blob | null = null;
    for (const quality of QUALITIES) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob || blob.size <= TARGET_BYTES) break;
    }
    // 줄인 결과가 더 크거나 실패하면 원본을 그대로 쓴다
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    // 브라우저가 읽지 못하는 형식(HEIC 등)은 원본 그대로 보내고 판단은 서버에 맡긴다
    return file;
  }
}
