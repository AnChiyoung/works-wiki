import styles from './SizeDelta.module.css';

/** 바이트 증감: 늘면 초록 +, 줄면 빨강 −, 그대로면 회색 0. 색과 기호를 함께 써서 색을 못 봐도 구분된다. */
export function SizeDelta({ value }: { value: number }) {
  const className = value > 0 ? styles.plus : value < 0 ? styles.minus : styles.zero;
  const text =
    value > 0
      ? `+${value.toLocaleString('ko-KR')}`
      : value < 0
        ? `−${(-value).toLocaleString('ko-KR')}`
        : '0';
  return (
    <span className={className} title={`${value} 바이트`}>
      {text}
    </span>
  );
}
