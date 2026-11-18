// markdown-it-footnote는 타입을 함께 주지 않는다. @types 패키지는 다른 markdown-it 타입에 기대므로 쓰지 않는다.
declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it';

  const footnotePlugin: PluginSimple;
  export default footnotePlugin;
}
