import { describe, expect, it } from 'vitest';
import { defaultParams as dialogueDefaults, toProps as dialogueProps } from '../templates/src/dialogue-shot/params';
import { defaultParams as avatarDefaults, toProps as avatarProps } from '../templates/src/avatar-card/params';

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
