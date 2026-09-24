import type { Paragraph } from './NewsHeadline';

/**
 * 正文排版：自己算每个字的位置，不交给浏览器换行。
 *
 * 原因有二：正文是一个字一个字淡入的，每个字得是单独的块；
 * 划线要画在重点句最长的那一行下面，得知道重点句在哪一行、从哪到哪。
 * 规则照原片：左对齐（原片右边不齐）、首行缩进，逗号句号不放行首（挂在行尾），引号开头不放行尾。
 */

/** 用 canvas 量字宽（系统字体不用等加载）；不在浏览器里（比如跑测试）就按字号估 */
let measureCtx: CanvasRenderingContext2D | null = null;
export function measure(text: string, font: string): number {
  if (typeof document === 'undefined') {
    const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
    return Array.from(text).reduce((w, ch) => w + (/[\x00-\xff]/.test(ch) ? 0.55 : 1) * size, 0);
  }
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return 0;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

export type BodyChar = {
  ch: string;
  x: number;
  /** 这一行字心的 y */
  center: number;
  width: number;
  paragraph: number;
  /** 在这一段里是第几个字 */
  index: number;
  /** 在这一段里是第几行（淡入一行一行来） */
  line: number;
  highlight: boolean;
};

export type Underline = { paragraph: number; x0: number; x1: number; center: number };

export type BodyLayout = { chars: BodyChar[]; underlines: Underline[]; lines: number };

export type BodyBox = { left: number; right: number; firstCenter: number; size: number; lineHeight: number; paragraphGap: number; indent: number };

/** 一笔划线最长多少个字宽 */
const UNDERLINE_MAX_EM = 19;

const CLOSING = new Set(Array.from('，。、；：！？”’）》」』…,.;:!?)'));
const OPENING = new Set(Array.from('“‘（《「『('));

type Token = { chars: { ch: string; i: number; w: number }[]; width: number };

export function layoutBody(paragraphs: Paragraph[], box: BodyBox, family: string): BodyLayout {
  const chars: BodyChar[] = [];
  const underlines: Underline[] = [];
  const avail = box.right - box.left;
  let line = 0;

  paragraphs.forEach((para, p) => {
    const text = para.text;
    const hl = para.highlight ? text.indexOf(para.highlight) : -1;
    const hlEnd = hl >= 0 ? hl + para.highlight.length : -1;
    const isHl = (i: number) => hl >= 0 && i >= hl && i < hlEnd;
    const glyphs = Array.from(text);

    // 英文、数字连在一起不拆开，其余每个字一个块
    const tokens: Token[] = [];
    glyphs.forEach((ch, i) => {
      const w = measure(ch, `${isHl(i) ? 500 : 400} ${box.size}px ${family}`);
      const last = tokens[tokens.length - 1];
      const prev = glyphs[i - 1];
      if (last && prev && /[A-Za-z0-9]/.test(ch) && /[A-Za-z0-9]/.test(prev)) {
        last.chars.push({ ch, i, w });
        last.width += w;
      } else {
        tokens.push({ chars: [{ ch, i, w }], width: w });
      }
    });

    // 贪心分行
    const lines: Token[][] = [[]];
    let x = box.indent * box.size;
    for (const tok of tokens) {
      const cur = lines[lines.length - 1]!;
      const first = tok.chars[0]!.ch;
      if (cur.length > 0 && x + tok.width > avail && !CLOSING.has(first)) {
        const carry: Token[] = [];
        while (cur.length > 1 && OPENING.has(cur[cur.length - 1]!.chars[0]!.ch)) carry.unshift(cur.pop()!);
        lines.push([...carry, tok]);
        x = carry.reduce((s, t) => s + t.width, 0) + tok.width;
      } else {
        cur.push(tok);
        x += tok.width;
      }
    }

    // 摆字
    lines.forEach((toks, li) => {
      const start = li === 0 ? box.indent * box.size : 0;
      let cx = box.left + start + (para.offsetX || 0);
      const center = box.firstCenter + line * box.lineHeight + p * box.paragraphGap;
      const segStart = chars.length;
      for (const tok of toks) {
        for (const c of tok.chars) {
          chars.push({ ch: c.ch, x: cx, center, width: c.w, paragraph: p, index: c.i, line: li, highlight: isHl(c.i) });
          cx += c.w;
        }
      }
      // 这一行里重点句的那一段；手画的线一笔最长约 19 个字，太长就只画后面那截（原片第二段就是这样）
      const seg = chars.slice(segStart).filter((c) => c.highlight);
      if (seg.length > 0) {
        const lastChar = seg[seg.length - 1]!;
        const x1 = lastChar.x + (CLOSING.has(lastChar.ch) ? lastChar.width * 0.5 : lastChar.width);
        const x0 = Math.max(seg[0]!.x, x1 - UNDERLINE_MAX_EM * box.size);
        const prev = underlines.find((u) => u.paragraph === p);
        if (!prev) underlines.push({ paragraph: p, x0, x1, center });
        else if (x1 - x0 > prev.x1 - prev.x0) Object.assign(prev, { x0, x1, center });
      }
      line += 1;
    });
  });

  return { chars, underlines, lines: line };
}
