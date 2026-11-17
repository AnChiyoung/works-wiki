'use client';

import { useEffect, useRef } from 'react';

// 렌더링된 문서 본문. 제목을 누르면 그 문단을 접고 펼친다. (SX-18, T023)
// HTML은 서버에서 정화(sanitize)를 거친 것만 받는다.

const HEADING = ':scope > .wiki-heading';

function levelOf(el: Element): number {
  return Number((el as HTMLElement).dataset.level ?? 0);
}

/** 접힌 제목 상태에 맞춰 본문 요소를 보이거나 숨긴다. */
function applyCollapsed(root: HTMLElement): void {
  let hideDeeperThan = Infinity; // 이 깊이보다 깊은 요소는 숨긴다 (Infinity = 숨기지 않음)
  for (const child of Array.from(root.children)) {
    const isHeading = child.matches('.wiki-heading');
    if (isHeading && levelOf(child) <= hideDeeperThan) hideDeeperThan = Infinity;
    const hidden = hideDeeperThan !== Infinity;
    child.classList.toggle('wiki-section-hidden', hidden);
    if (isHeading && !hidden && child.classList.contains('is-collapsed')) hideDeeperThan = levelOf(child);
  }
}

function setCollapsed(heading: Element, collapsed: boolean): void {
  heading.classList.toggle('is-collapsed', collapsed);
  heading.setAttribute('aria-expanded', String(!collapsed));
}

/** 주소의 #s-1.2 같은 대상이 보이도록, 그 대상과 그것을 감싼 접힌 제목들을 펼친다. */
function revealTarget(root: HTMLElement, id: string): void {
  const target = document.getElementById(id);
  if (!target || !root.contains(target)) return;
  const top = Array.from(root.children).find((c) => c === target || c.contains(target));
  if (!top) return;

  if (top.matches('.wiki-heading')) setCollapsed(top, false);
  let minLevel = top.matches('.wiki-heading') ? levelOf(top) : Infinity;
  for (let el = top.previousElementSibling; el; el = el.previousElementSibling) {
    if (el.matches('.wiki-heading') && levelOf(el) < minLevel) {
      setCollapsed(el, false);
      minLevel = levelOf(el);
    }
  }
  applyCollapsed(root);
  target.scrollIntoView();
}

export function WikiContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const headings = Array.from(root.querySelectorAll(HEADING));
    for (const h of headings) {
      h.setAttribute('tabindex', '0');
      h.setAttribute('aria-expanded', 'true');
    }

    const toggle = (heading: Element) => {
      setCollapsed(heading, !heading.classList.contains('is-collapsed'));
      applyCollapsed(root);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('a')) return; // 번호 링크(목차로 이동) 등은 접기와 따로 동작
      const heading = target.closest('.wiki-heading');
      if (heading && heading.parentElement === root) toggle(heading);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element;
      const isHeading = target.classList.contains('wiki-heading') && target.parentElement === root;
      if (isHeading && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        toggle(target);
      }
    };
    const onHashChange = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id) revealTarget(root, id);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [html]);

  return <div ref={ref} className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
