import type { ButtonHTMLAttributes } from 'react';
import styles from './PrimaryButton.module.css';

export default function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={[styles.button, className].filter(Boolean).join(' ')} {...props} />;
}
