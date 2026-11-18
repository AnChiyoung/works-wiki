// 각주 말풍선 (syntax.md SX-33)
//
// - 데스크톱: 각주 번호에 마우스를 올리거나 키보드로 초점을 옮기면 각주 내용이 말풍선으로 보인다.
//   번호를 누르면 원래대로 문서 끝 각주로 이동한다.
// - 터치: 번호를 누르면 이동하지 않고 말풍선을 연다. 다시 누르거나 바깥을 누르면 닫힌다.
// - 자바스크립트가 없으면 번호는 그냥 문서 끝 각주로 가는 링크다.
// 말풍선 내용은 서버에서 정화를 거친 각주 목록의 노드를 복제해서 쓴다.

const REF = 'sup.footnote-ref > a';
const GAP = 6;
const MARGIN = 12;

export function attachFootnoteTooltips(root: HTMLElement): () => void {
  if (!root.querySelector(REF)) return () => {};

  const tip = document.createElement('div');
  tip.className = 'footnote-tooltip';
  tip.id = 'footnote-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);

  let current: HTMLAnchorElement | null = null;
  let lastPointer = 'mouse';
  let hideTimer: number | undefined;

  const footnoteFor = (ref: HTMLAnchorElement) => {
    const id = decodeURIComponent(ref.hash.slice(1));
    return id ? document.getElementById(id) : null;
  };

  const place = (ref: HTMLAnchorElement) => {
    const rect = ref.getBoundingClientRect();
    const maxLeft = document.documentElement.clientWidth - tip.offsetWidth - MARGIN;
    const left = Math.max(MARGIN, Math.min(rect.left, maxLeft));
    // 아래 공간이 모자라면 위에 띄운다
    const below = rect.bottom + GAP;
    const top = below + tip.offsetHeight > window.innerHeight ? rect.top - GAP - tip.offsetHeight : below;
    tip.style.left = `${left + window.scrollX}px`;
    tip.style.top = `${Math.max(MARGIN, top) + window.scrollY}px`;
  };

  const show = (ref: HTMLAnchorElement) => {
    window.clearTimeout(hideTimer);
    const note = footnoteFor(ref);
    if (!note) return;
    if (current && current !== ref) current.removeAttribute('aria-describedby');
    const content = note.cloneNode(true) as HTMLElement;
    content.querySelectorAll('.footnote-backref').forEach((el) => el.remove());
    content.removeAttribute('id');
    tip.replaceChildren(...Array.from(content.childNodes));
    tip.hidden = false;
    place(ref);
    ref.setAttribute('aria-describedby', tip.id);
    current = ref;
  };

  const hide = () => {
    window.clearTimeout(hideTimer);
    tip.hidden = true;
    current?.removeAttribute('aria-describedby');
    current = null;
  };

  // 말풍선 안으로 마우스를 옮길 시간을 조금 준다
  const hideSoon = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, 150);
  };

  const refOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLAnchorElement>(REF) : null;

  // 터치하면 초점(focusin)으로 먼저 열리므로, 누르기 전에 이미 열려 있었는지 기억해 두고 click에서 판단한다
  let wasOpenOnPointerDown = false;
  const onPointerDown = (event: PointerEvent) => {
    lastPointer = event.pointerType;
    const ref = refOf(event.target);
    wasOpenOnPointerDown = ref !== null && current === ref && !tip.hidden;
  };
  const onMouseOver = (event: MouseEvent) => {
    const ref = refOf(event.target);
    if (ref && lastPointer === 'mouse') show(ref);
  };
  const onMouseOut = (event: MouseEvent) => {
    if (refOf(event.target) && lastPointer === 'mouse') hideSoon();
  };
  const onFocusIn = (event: FocusEvent) => {
    const ref = refOf(event.target);
    if (ref) show(ref);
  };
  const onFocusOut = (event: FocusEvent) => {
    if (refOf(event.target)) hideSoon();
  };
  const onClick = (event: MouseEvent) => {
    const ref = refOf(event.target);
    if (ref && lastPointer === 'touch') {
      event.preventDefault();
      if (wasOpenOnPointerDown) hide();
      else show(ref);
      return;
    }
    if (!ref && !tip.contains(event.target as Node)) hide();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hide();
  };

  root.addEventListener('mouseover', onMouseOver);
  root.addEventListener('mouseout', onMouseOut);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  tip.addEventListener('mouseenter', () => window.clearTimeout(hideTimer));
  tip.addEventListener('mouseleave', hideSoon);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', hide);

  return () => {
    window.clearTimeout(hideTimer);
    root.removeEventListener('mouseover', onMouseOver);
    root.removeEventListener('mouseout', onMouseOut);
    root.removeEventListener('focusin', onFocusIn);
    root.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', hide);
    tip.remove();
  };
}
