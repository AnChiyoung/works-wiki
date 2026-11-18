'use client';

import { useEffect, useRef } from 'react';
import { attachFootnoteTooltips } from './footnote-tooltip';

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
  // 대상을 감싼 접기 상자(SX-40)도 펼친다
  for (let el = target.parentElement?.closest('details'); el && root.contains(el);) {
    el.open = true;
    el = el.parentElement?.closest('details');
  }
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

/** 번호를 뺀 제목 글자가 같은 첫 제목의 id */
function findHeadingIdByText(root: HTMLElement, text: string): string | undefined {
  const wanted = text.trim();
  return Array.from(root.querySelectorAll<HTMLElement>('.wiki-heading')).find(
    (h) => h.querySelector('.heading-text')?.textContent?.trim() === wanted,
  )?.id;
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
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return; // 잘못 인코딩된 주소(#%)는 무시한다
      }
      if (!id) return;
      // [[문서#역사]] 링크는 #역사로 들어온다. 고정 주소(#s-1.2)가 아니면 글자가 같은 제목을 찾는다 (SX-24)
      const targetId = document.getElementById(id) ? id : findHeadingIdByText(root, id);
      if (targetId) revealTarget(root, targetId);
    };

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    const detachTooltips = attachFootnoteTooltips(root); // SX-33
    return () => {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('hashchange', onHashChange);
      detachTooltips();
    };
  }, [html]);

  return <div ref={ref} className="wiki-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
