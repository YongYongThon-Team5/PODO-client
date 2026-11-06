import { NavLink } from 'react-router-dom';
import myIcon from '../assets/gnb-my.svg';
import homeIcon from '../assets/gnb-home.svg';
import mapIcon from '../assets/gnb-map.svg';
import missionIcon from '../assets/gnb-mission.svg';
import styles from './Gnb.module.css';

// 아이콘 크기와 라벨 간격은 Figma GNB 컴포넌트 값 그대로
const ITEMS = [
  { to: '/my', label: '마이', icon: myIcon, w: 29, h: 29, gap: -3 },
  { to: '/home', label: '홈', icon: homeIcon, w: 25, h: 25, gap: 0 },
  { to: '/map', label: '지도', icon: mapIcon, w: 29, h: 24, gap: 0 },
  { to: '/mission', label: '미션', icon: missionIcon, w: 23, h: 24, gap: 0 },
];

export default function Gnb() {
  return (
    <nav className={styles.gnb}>
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className={styles.item}>
          <img src={item.icon} width={item.w} height={item.h} alt="" />
          {/* CSS gap은 음수가 안 돼서 라벨 margin으로 처리 */}
          <span className={styles.label} style={{ marginTop: item.gap }}>
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
