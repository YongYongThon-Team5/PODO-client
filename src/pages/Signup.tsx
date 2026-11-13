import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButtons from '../components/ActionButtons';
import Chip, { ChipGroup } from '../components/Chip';
import Gnb from '../components/Gnb';
import LoadError from '../components/LoadError';
import PageHeader from '../components/PageHeader';
import { ApiError } from '../api/errors';
import { useChildProfiles, useCreateChildProfile, useProfileOptions } from '../api/queries';
import styles from './Signup.module.css';
import { figmaColorOptions } from '../lib/childColors';

type Form = {
  nickname: string;
  ageBandCode: string | null;
  interestCategoryIds: string[];
  bookGenreIds: string[];
  colorCode: string | null;
};

const EMPTY: Form = { nickname: '', ageBandCode: null, interestCategoryIds: [], bookGenreIds: [], colorCode: null };

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Figma "회원가입" (아이 프로필) */
export default function Signup() {
  const navigate = useNavigate();
  const options = useProfileOptions();
  const profiles = useChildProfiles();
  const create = useCreateChildProfile();
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const opt = options.data;
  const active = <T extends { active?: boolean }>(list: T[] | undefined) => (list ?? []).filter((o) => o.active !== false);
  const usedColors = new Set((profiles.data ?? []).map((p) => p.colorCode));
  // 화면에는 Figma 색(파스텔 4가지)을 그리고, 저장은 서버 색 코드로 한다
  const colors = figmaColorOptions(active(opt?.colors));

  // 색은 서버 필수값이라, 고르지 않으면 아직 안 쓴 첫 색으로 정한다
  const pickColor = () =>
    form.colorCode ??
    (colors.find((c) => opt?.colorPolicy?.allowDuplicates || !usedColors.has(c.code ?? ''))?.code ?? colors[0]?.code);

  const save = async () => {
    const nickname = form.nickname.trim();
    if (!nickname) {
      setMessage({ text: '아이 이름(별명)을 적어 주세요.' });
      nameRef.current?.focus();
      return null;
    }
    const colorCode = pickColor();
    if (!colorCode) {
      setMessage({ text: '색 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.' });
      return null;
    }
    setMessage(null);
    try {
      return await create.mutateAsync({ ...form, nickname, colorCode });
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : '저장하지 못했어요. 다시 시도해 주세요.' });
      if (e instanceof ApiError && e.status === 401) navigate('/login');
      return null;
    }
  };

  const complete = async () => {
    if (await save()) navigate('/location');
  };

  const addAnother = async () => {
    const saved = await save();
    if (!saved) return;
    setForm(EMPTY);
    setMessage({ text: `${saved.nickname} 프로필을 저장했어요. 다음 아이를 입력해 주세요.`, ok: true });
    nameRef.current?.focus();
  };

  return (
    <main className="screen">
      <PageHeader
        title="아이 프로필"
        action={
          <button type="button" className={styles.addChild} onClick={addAnother}>
            + 아이 추가하기
          </button>
        }
      />

      <div className={styles.scroll}>
        <div className={styles.fields}>
          {options.isError && (
            <LoadError message="선택 목록을 불러오지 못했어요." onRetry={() => options.refetch()} />
          )}
          <section className={styles.field}>
            <label className={styles.label} htmlFor="nickname">
              아이 이름(별명)
            </label>
            <input
              ref={nameRef}
              id="nickname"
              className={styles.input}
              placeholder="예) 하늘이"
              maxLength={30}
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            />
          </section>

          <section className={styles.field}>
            <h2 className={styles.label}>나이</h2>
            {active(opt?.ageBands).length > 0 ? (
              <ChipGroup>
                {active(opt?.ageBands).map((a) => (
                  <Chip
                    key={a.code}
                    selected={form.ageBandCode === a.code}
                    onClick={() => setForm({ ...form, ageBandCode: form.ageBandCode === a.code ? null : a.code! })}
                  >
                    {a.label}
                  </Chip>
                ))}
              </ChipGroup>
            ) : (
              <p className={styles.empty}>{options.isLoading ? '불러오는 중…' : '나이 선택지를 준비 중이에요.'}</p>
            )}
          </section>

          <section className={styles.field}>
            <h2 className={styles.label}>좋아하는 것 (여러 개)</h2>
            <ChipGroup>
              {active(opt?.interestCategories).map((c) => (
                <Chip
                  key={c.id}
                  selected={form.interestCategoryIds.includes(c.id!)}
                  onClick={() => setForm({ ...form, interestCategoryIds: toggle(form.interestCategoryIds, c.id!) })}
                >
                  {c.label}
                </Chip>
              ))}
            </ChipGroup>
          </section>

          <section className={styles.field}>
            <h2 className={styles.label}>좋아하는 책 분야 (선택)</h2>
            <ChipGroup>
              {active(opt?.bookGenres).map((g) => (
                <Chip
                  key={g.id}
                  selected={form.bookGenreIds.includes(g.id!)}
                  onClick={() => setForm({ ...form, bookGenreIds: toggle(form.bookGenreIds, g.id!) })}
                >
                  {g.label}
                </Chip>
              ))}
            </ChipGroup>
          </section>

          <section className={styles.field}>
            <h2 className={styles.label}>좋아하는 색깔 (선택)</h2>
            <div className={styles.colors}>
              {colors.map((c) => {
                const taken = !opt?.colorPolicy?.allowDuplicates && usedColors.has(c.code ?? '');
                return (
                  <button
                    key={c.code}
                    type="button"
                    className={`${styles.color} ${form.colorCode === c.code ? styles.colorSelected : ''}`}
                    style={{ background: c.hex }}
                    disabled={taken}
                    aria-pressed={form.colorCode === c.code}
                    aria-label={taken ? `${c.label} (다른 아이가 사용 중)` : c.label}
                    onClick={() => setForm({ ...form, colorCode: form.colorCode === c.code ? null : c.code! })}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <div className={styles.bottom}>
          {message && (
            <p className={`${styles.message} ${message.ok ? styles.messageOk : ''}`} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          <ActionButtons
            primary="완료"
            secondary="건너뛰기"
            onPrimary={complete}
            onSecondary={() => navigate('/location')}
            busy={create.isPending}
          />
        </div>
      </div>

      <Gnb />
    </main>
  );
}
