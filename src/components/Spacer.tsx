type Props = {
  /** Figma 기준(874px 높이) 여백. 화면이 짧아지면 이 비율대로 줄어든다. */
  grow: number;
};

export default function Spacer({ grow }: Props) {
  return <div aria-hidden style={{ flex: `${grow} 1 0px`, minHeight: 0 }} />;
}
