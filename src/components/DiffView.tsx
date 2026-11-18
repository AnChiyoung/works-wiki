import type { DiffPart, DiffRow } from '@/server/services/diff';
import styles from './DiffView.module.css';

function Parts({ parts }: { parts: DiffPart[] }) {
  return parts.map((part, i) =>
    part.changed ? (
      <span key={i} className={styles.changed}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

/**
 * 차이를 위아래 한 줄 형식으로 보여준다 (AC-4.2, T043). 휴대폰에서도 읽히도록 좌우 나란히 보기는 쓰지 않는다.
 * 줄 앞의 +·− 기호로 색을 못 봐도 추가·삭제를 구분할 수 있다.
 */
export function DiffView({ rows }: { rows: DiffRow[] }) {
  return (
    <div className={styles.diff} role="table" aria-label="차이">
      {rows.map((row, i) => {
        if (row.type === 'skip') {
          return (
            <div key={i} className={styles.skip} role="row">
              <span role="cell">… 바뀌지 않은 {row.count}줄 …</span>
            </div>
          );
        }
        const oldNo = row.type === 'added' ? '' : row.oldNo;
        const newNo = row.type === 'removed' ? '' : row.newNo;
        const mark = row.type === 'added' ? '+' : row.type === 'removed' ? '−' : ' ';
        const label = row.type === 'added' ? '추가' : row.type === 'removed' ? '삭제' : '같음';
        return (
          <div key={i} className={`${styles.row} ${styles[row.type]}`} role="row" data-type={row.type}>
            <span className={styles.no} role="cell" aria-label="이전 줄 번호">
              {oldNo}
            </span>
            <span className={styles.no} role="cell" aria-label="이후 줄 번호">
              {newNo}
            </span>
            <span className={styles.mark} role="cell" aria-label={label}>
              {mark}
            </span>
            <span className={styles.text} role="cell">
              {row.type === 'same' ? row.text : <Parts parts={row.parts} />}
              {row.text === '' && ' '}
            </span>
          </div>
        );
      })}
    </div>
  );
}
