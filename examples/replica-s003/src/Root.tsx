import { Composition } from 'remotion';
import { DialogueShot, dialogueShotSchema } from './DialogueShot';

// 默认值直接写成对象字面量，Remotion Studio 才能把你在右侧面板里改的值自动存回来。
// 存回时会重新排版、清掉对象里的注释，所以说明都写在这里：
//
// 默认值 = 原片 s003 逐帧实测（帧号从 0 开始 = 原片帧号 − 1），底图换成了自己画的示例图 sample.jpg
//   镜头    开场 3.23 倍、斜 29.9°，拉远到 1 倍（缓动 ≈ cubic-bezier(1,0,0,1)）；148→201 帧推近到 1.198 倍
//   气泡 1  从上方 120px 落下并淡入（44→101 帧，起始模糊 11px，73 帧变清晰）；145→173 帧加速上飞离场
//   气泡 2  从画面下方外 377px 升起（179→205 帧），几乎停住就上飞离场（204→220 帧）
//   气泡 3  从下方 325px 升起（233→269 帧），停到结尾
//   只有气泡 1 入场是真的淡入。其余进出场看起来发虚是运动模糊（快门 0.27 帧），不透明度始终是 1
//   气泡底色是横向渐变（中间灰度 ≈33，左 19、右 23）；投影偏左下：偏移 (−28, 34)，σ=13，不透明度 0.39
// 原片精确测量值（含 0.9989 这类测量残差）在 replica-props.json，复刻验证用。
export const RemotionRoot: React.FC = () => (
  <Composition
    id="DialogueShot"
    component={DialogueShot}
    schema={dialogueShotSchema}
    width={1280}
    height={720}
    fps={30}
    // 原片这一段 9.1 秒 = 273 帧
    durationInFrames={273}
    defaultProps={{
      image: 'sample.jpg',
      zoomImage: '',
      camera: {
        startScale: 3.2335,
        startRotation: 29.908,
        focusX: 640,
        focusY: 360,
        restScale: 1,
        restRotation: 0,
        endScale: 1.198,
        zoomOut: {
          start: -1,
          end: 97.74,
          easing: [1, -0.031, 0, 1.014],
        },
        unrotate: {
          start: 0,
          end: 96.43,
          easing: [1, -0.056, 0, 0.999],
        },
        pushIn: {
          start: 147.64,
          end: 200.95,
          easing: [1, 0.046, 0, 0.966],
        },
        zoomImageFade: [45, 56],
      },
      motionBlur: {
        enabled: true,
        shutter: 0.27,
        samples: 10,
        minSpeed: 3,
      },
      bubbleStyle: {
        fontSize: 37.85,
        fontWeight: 350,
        textOffsetY: -3,
        textBlur: 0.6,
        paddingX: 40,
        height: 82,
        radius: 22,
        fill: 'linear-gradient(to right, #121212 0%, #1b1b1b 25%, #202020 50%, #1f1f1f 75%, #161616 100%)',
        borderTop: 'rgba(255,255,255,0.28)',
        borderBottom: 'rgba(255,255,255,0.33)',
        textColor: '#dadada',
        highlightColor: '#d8b45a',
        shadow: '-28px 34px 26px rgba(0,0,0,0.39)',
      },
      showPillarbox: true,
      bubbles: [{
        text: '这周末，我们要在上海办一场品牌快闪活动',
        highlight: '',
        x: 640,
        y: 355.5,
        enter: {
          start: 44.03,
          end: 101.53,
          distance: -120.3,
          easing: [0.227, 0.256, 0.353, 0.945],
          opacity: 0,
          fade: {
            start: 42.5,
            end: 99.4,
            easing: [0, 0, 1, 1],
          },
          blur: 11,
          blurEnd: 73,
        },
        exit: {
          start: 145.12,
          end: 173.07,
          distance: -534.5,
          easing: [0.207, 0.039, 0.888, 0.085],
          opacity: 1,
          fade: {
            start: 145.12,
            end: 173.07,
            easing: [0, 0, 1, 1],
          },
          blur: 0,
          blurEnd: 0,
        },
      }, {
        text: '你 48 小时内，给我一份完整策划案',
        highlight: '48 小时内',
        x: 640,
        y: 360,
        enter: {
          start: 178.73,
          end: 205.18,
          distance: 377.4,
          easing: [0.015, 0.098, 0.159, 0.871],
          opacity: 1,
          fade: {
            start: 178.73,
            end: 205.18,
            easing: [0, 0, 1, 1],
          },
          blur: 0,
          blurEnd: 0,
        },
        exit: {
          start: 204.41,
          end: 219.86,
          distance: -276.5,
          easing: [0.936, 0, 0.921, 1.298],
          opacity: 1,
          fade: {
            start: 204.41,
            end: 219.86,
            easing: [0, 0, 1, 1],
          },
          blur: 0,
          blurEnd: 0,
        },
      }, {
        text: '收到....',
        highlight: '',
        x: 640,
        y: 367.5,
        enter: {
          start: 233.09,
          end: 268.74,
          distance: 324.9,
          easing: [0.076, 0.334, 0.32, 1.059],
          opacity: 1,
          fade: {
            start: 233.09,
            end: 268.74,
            easing: [0, 0, 1, 1],
          },
          blur: 0,
          blurEnd: 0,
        },
        exit: {
          start: 9999,
          end: 10000,
          distance: 0,
          easing: [0, 0, 1, 1],
          opacity: 1,
          fade: {
            start: 9999,
            end: 10000,
            easing: [0, 0, 1, 1],
          },
          blur: 0,
          blurEnd: 0,
        },
      }],
    }}
  />
);
