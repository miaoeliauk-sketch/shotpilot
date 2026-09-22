# 设计说明

## 这个工具在 hypit 生态里的位置

hypit 现在的入口是「丢一个视频 → agent 直接克隆成 SVML 工作流」，**中间那层人能看、
能改、能标注的拉片结果是黑盒的**。ShotPilot 把这层黑盒显式化：

```
参考视频
   ↓  自动分镜切分 / 逐词转写 / 音频分析      ← 本地 ffmpeg，零费用
分镜时间线
   ↓  人工标注 + AI 初判（景别/运镜/光线/构图）
结构化拉片数据（handoff JSON）
   ↓
   ├─→ Markdown 拉片笔记          给人学习用
   └─→ SVML                       给 hypit agent 复刻用
```

关键判断：**拉片产物应该是 SVML 的输入源，而不是 SVML 的附属品**。做对了，
人工标注和 AI 复刻共用同一份结构化数据；做错了，就会变成两套互相对不上的东西。

## 三个贯穿全局的设计约束

### 1. 标注来源必须字段级可追溯

`Shot.annotationSource` 记录每个字段是 `manual` / `ai` / `ai-edited`。

这不是锦上添花——没有它，AI 批量标注跑第二轮就会把人工修正冲掉，
而拉片的人工投入是以小时计的。粒度必须到字段，不能到镜头：
同一个镜头的景别可能是 AI 判的，运镜是人改的。

### 2. 重新切分不能丢标注

场景阈值对不同片子差异极大（快剪短视频 vs 慢节奏长镜头），第一次切出来
几乎必然要调。`carryOverAnnotations` 按时间重叠迁移标注，且重叠不足新镜头
一半时不继承——宁可空着，也不能张冠李戴。

### 3. 不确定就返回 null，不编数字

- BPM 测不准时返回 `null`，界面显示「未测出稳定节奏」
- 没跑转写时不谎称能区分人声与音乐，`audio.method` 写明判据
- SRT 均摊出的时间标记为非真实词级对齐
- AI 返回的枚举值一律过白名单校验，编造的值直接丢弃

拉片是用来学习的，一个编出来的数字比没有数字危害大得多。

## 为什么词级时间戳是硬需求

hypit 的 SVML 把元素锚定在**词**上而不是**秒**上，改一句话时间轴会自动 reflow。
普通 SRT 只有句级时间，喂过去就丢掉了这个能力。所以：

- 本地转写选 WhisperX 而非原版 whisper —— 它做强制对齐，词级精度高一个档次
  （hypit 自己的 `provider-whisperx-local` 也是这个选择）
- SRT 导入是兜底，且明确标记为近似

词级时间戳还被复用在音频分析上：有词=人声，有声无词=音乐。
这比自己写一个半吊子的 speech/music 分类器准得多，而且用户能理解为什么这样标。

## 模块划分

| 模块 | 职责 |
| --- | --- |
| `core/vocabulary.ts` | 标注词汇表。快捷键唯一性由测试保证 |
| `core/types.ts` | 数据模型 + 时间/文本工具 |
| `core/project.ts` | 项目读写。**原子写盘**（临时文件 + rename），防止写到一半损坏 |
| `analyze/ffmpeg.ts` | 二进制解析。会校验文件真实存在，因为 ffmpeg-static 的 postinstall 在代理环境常静默失败 |
| `analyze/shots.ts` | 场景检测、镜头构建、标注迁移 |
| `analyze/audio.ts` | PCM 包络、起音检测、BPM 估算、段落切分 |
| `analyze/transcribe.ts` | WhisperX / SRT / whisper JSON |
| `analyze/vision.ts` | AI 初判。多帧送模型、输出过白名单校验 |
| `export/` | Markdown 笔记、SVML、handoff JSON |
| `server/` | 本地 HTTP。**必须支持 Range**，否则时间线拖拽不可用 |

## 下一步（对应逐字稿里说的「AI 复刻」）

当前版本做完了「拉片」，复刻还没做。往下走需要：

1. **镜头级复刻指令生成**：把 `annotation` + `brollContent` 翻译成生成模型能吃的提示词
2. **A-roll 变换参数**：逐字稿提到的「A-roll 的放大缩小」，需要在标注里加 transform 字段
3. **B-roll 拆解建议**：基于 `brollNeed` 字段，自动给出哪些段落需要补画面
4. **对齐 hypit 官方镜头词汇表**：改 `SHOT_VOCAB` 一处，SVML 即可被 hypit 直接消费
5. **跨片聚合**：拉多部同一博主的片子，统计他的景别分布、平均镜头时长、A/B-roll 配比
