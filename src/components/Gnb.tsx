import { NavLink } from 'react-router-dom';
import homeIcon from '../assets/gnb-home.svg';
import mapIcon from '../assets/gnb-map.svg';
import missionIcon from '../assets/gnb-mission.svg';
import myIcon from '../assets/gnb-my.svg';
import styles from './Gnb.module.css';

// Figma 컴포넌트 "GNB" (11.08): 칸 4개, 아이콘 크기는 컴포넌트 값 그대로
const ITEMS = [
  { to: '/home', label: '홈', icon: homeIcon, w: 19, h: 19, top: 18 },
  { to: '/map', label: '지도', icon: mapIcon, w: 29, h: 24, top: 15 },
  { to: '/mission', label: '미션', icon: missionIcon, w: 25, h: 25, top: 15 },
  { to: '/my', label: '마이페이지', icon: myIcon, w: 29, h: 29, top: 11 },
];

export default function Gnb() {
  return (
    <nav className={styles.gnb}>
      <div className={styles.tabs}>
        {ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className={styles.item}>
            <img src={item.icon} width={item.w} height={item.h} alt="" style={{ top: item.top }} />
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
