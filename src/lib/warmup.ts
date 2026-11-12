/*
 * 첫 화면이 뜬 뒤 한가할 때, 다음 화면들이 쓰는 그림(여우·아이콘·지도)을 미리 받아 둔다.
 * 화면을 넘겼을 때 그림 자리가 잠깐 비어 보이는 것을 막는다. 화면 모습은 바꾸지 않는다.
 */
const urls = import.meta.glob<string>('../assets/*.{png,webp,svg}', { eager: true, query: '?url', import: 'default' });

type Connection = { saveData?: boolean; effectiveType?: string };

export function warmUpImages() {
  const conn = (navigator as Navigator & { connection?: Connection }).connection;
  // 데이터 절약 모드·아주 느린 연결에서는 미리 받지 않는다
  if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return;

  const list = Object.entries(urls)
    // 온보딩 큰 사진은 그 화면에서만 쓰므로 제외
    .filter(([path]) => !/onboarding-\d/.test(path))
    .map(([, url]) => url);

  const run = () => {
    for (const url of list) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}
