import { describe, expect, it } from 'vitest';
import { defaultParams as dialogueDefaults, meta as dialogueMeta, toProps as dialogueProps } from '../templates/src/dialogue-shot/params';
import { defaultParams as avatarDefaults, meta as avatarMeta, toProps as avatarProps } from '../templates/src/avatar-card/params';

describe('对话气泡模板：简单参数换算', () => {
  const props = dialogueProps(dialogueDefaults);

  it('默认参数复现原片三个气泡的实测时间（帧，误差 < 0.5）', () => {
    const [b1, b2, b3] = props.bubbles;
    expect(b1?.enter.start).toBeCloseTo(44.03, 0);
    expect(b1?.exit.start).toBeCloseTo(145.12, 0);
    expect(b2?.enter.start).toBeCloseTo(178.73, 0);
    expect(b2?.exit.start).toBeCloseTo(204.41, 0);
    expect(b3?.enter.start).toBeCloseTo(233.09, 0);
  });

  it('默认镜头复现原片：3.23 倍、斜 29.9°，拉远在第 97.7 帧到位，推近到 1.2 倍', () => {
    expect(props.camera.startScale).toBeCloseTo(3.23, 2);
    expect(props.camera.startRotation).toBeCloseTo(29.9, 1);
    expect(props.camera.zoomOut.end).toBeCloseTo(97.74, 0);
    expect(props.camera.pushIn.start).toBeCloseTo(147.64, 0);
    expect(props.camera.pushIn.end).toBeCloseTo(200.95, 0);
    expect(props.durationInFrames).toBe(273);
  });

  it('「从上方落下」是真淡入（起始不透明度 0、带模糊），「从下方升起」不透明', () => {
    const [b1, b2] = props.bubbles;
    expect(b1?.enter.opacity).toBe(0);
    expect(b1?.enter.blur).toBeGreaterThan(0);
    expect(b1?.enter.distance).toBeLessThan(0);
    expect(b2?.enter.opacity).toBe(1);
    expect(b2?.enter.distance).toBeGreaterThan(0);
  });

  it('「一直停到结尾」不会离场', () => {
    const b3 = props.bubbles[2];
    expect(b3?.exit.start).toBeGreaterThan(props.durationInFrames * 100);
  });

  it('改出现时间只平移入场，不改动效本身', () => {
    const moved = dialogueProps({ ...dialogueDefaults, bubbles: [{ ...dialogueDefaults.bubbles[0]!, appearAt: 3 }] });
    const a = props.bubbles[0]!.enter;
    const b = moved.bubbles[0]!.enter;
    expect(b.start).toBeCloseTo(90, 5);
    expect(b.end - b.start).toBeCloseTo(a.end - a.start, 5);
    expect(b.easing).toEqual(a.easing);
  });

  it('底色做成中间略亮的横向渐变', () => {
    const p = dialogueProps({ ...dialogueDefaults, bubbleColor: '#101010' });
    expect(p.bubbleStyle.fill).toContain('#101010 0%');
    expect(p.bubbleStyle.fill).toContain('#1e1e1e 50%');
  });

  it('字号变了，气泡高度和圆角等比缩放', () => {
    const p = dialogueProps({ ...dialogueDefaults, fontSize: 37.85 * 2 });
    expect(p.bubbleStyle.height).toBeCloseTo(164, 5);
    expect(p.bubbleStyle.radius).toBeCloseTo(44, 5);
  });

  it('特写焦点按百分比换算成画面像素', () => {
    const p = dialogueProps({ ...dialogueDefaults, focusX: 25, focusY: 75 });
    expect(p.camera.focusX).toBe(320);
    expect(p.camera.focusY).toBe(540);
  });
});

describe('头像卡片模板', () => {
  it('默认时长复现原片 65 帧', () => {
    expect(avatarProps(avatarDefaults).durationInFrames).toBe(65);
  });
});

describe('对话气泡模板：时间轴', () => {
  const tl = dialogueMeta.timeline!;
  const params = dialogueDefaults as unknown as Record<string, unknown>;
  const tracks = tl.tracks(params);

  it('一条镜头轨，每个气泡一条轨；气泡块从出现画到飞走结束', () => {
    expect(tracks.map((t) => t.label)).toEqual(['镜头', '气泡 1', '气泡 2', '气泡 3']);
    const b1 = tracks[1]!.items[0]!;
    expect(b1.start).toBeCloseTo(1.47, 5);
    expect(b1.end).toBeCloseTo(4.84 + 27.95 / 30, 5);
    expect(b1.phases?.map((p) => p.label)).toEqual(['落下', '飞走']);
    expect(b1.select).toEqual({ list: 'bubbles', index: 0 });
  });

  it('停到结尾的气泡画到视频结束，右边那头不能拖', () => {
    const b3 = tracks[3]!.items[0]!;
    expect(b3.end).toBeCloseTo(9.1, 5);
    expect(b3.drag.end).toBeFalsy();
  });

  it('整块挪动：出现和飞走一起平移，并对齐到整帧', () => {
    const next = tl.apply(params, 'bubble-0', 'move', 2.5, 99) as unknown as typeof dialogueDefaults;
    expect(next.bubbles[0]!.appearAt).toBeCloseTo(2.5, 5);
    expect(next.bubbles[0]!.leaveAt).toBeCloseTo(5.87, 5);
    expect(next.bubbles[1]).toEqual(dialogueDefaults.bubbles[1]);
  });

  it('拖右边那头改飞走时间，扣掉飞走动作本身的长度', () => {
    const next = tl.apply(params, 'bubble-0', 'end', 1.47, 6) as unknown as typeof dialogueDefaults;
    expect(next.bubbles[0]!.leaveAt).toBeCloseTo(5.07, 5);
  });

  it('飞走不会被拖到出现之前', () => {
    const next = tl.apply(params, 'bubble-0', 'end', 1.47, 0) as unknown as typeof dialogueDefaults;
    expect(next.bubbles[0]!.leaveAt).toBeGreaterThan(next.bubbles[0]!.appearAt);
  });

  it('推近：拖左边那头，结束时间不变', () => {
    const next = tl.apply(params, 'pushIn', 'start', 4.5, 0) as unknown as typeof dialogueDefaults;
    expect(next.pushInAt).toBeCloseTo(4.5, 5);
    expect(next.pushInAt + next.pushInSeconds).toBeCloseTo(4.92 + 1.78, 2);
  });

  it('拉远只能拖结束那头，改的是拉远用时', () => {
    expect(tracks[0]!.items[0]!.drag).toEqual({ end: true });
    const next = tl.apply(params, 'zoomOut', 'end', 0, 2.2) as unknown as typeof dialogueDefaults;
    expect(next.zoomOutSeconds).toBeCloseTo(2.2, 5);
  });
});

describe('头像卡片模板：时间轴', () => {
  it('拖右边那头改视频时长，最短 1 秒', () => {
    const tl = avatarMeta.timeline!;
    const params = avatarDefaults as unknown as Record<string, unknown>;
    expect(tl.tracks(params)[0]!.items[0]!.end).toBeCloseTo(2.17, 5);
    expect(tl.apply(params, 'spin', 'end', 0, 4.04).duration).toBeCloseTo(4, 5);
    expect(tl.apply(params, 'spin', 'end', 0, 0.2).duration).toBe(1);
  });
});
