// 백엔드 Swagger 최신본을 docs/openapi.json으로 내려받는다. 이후 `npm run api:types`로 타입 재생성.
import { writeFileSync } from 'node:fs';

const origin = process.env.API_ORIGIN ?? 'https://52.78.237.200';
const url = `${origin}/v3/api-docs/podo`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`Swagger 요청 실패: ${res.status} ${url}`);
  process.exit(1);
}
const spec = await res.json();
writeFileSync('docs/openapi.json', `${JSON.stringify(spec, null, 2)}\n`);
console.log(`docs/openapi.json 갱신 (${Object.keys(spec.paths).length}개 경로)`);
