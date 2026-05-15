# Research Sidecar 工作区

[English](README.md) | 中文

这个仓库包含 **Research Sidecar**：一个用于研究工作的本地 Web 应用和 npm CLI，同时包含配套的 workspace skills，方便 Codex 按同一套研究流程理解和维护项目。

Research Sidecar 面向一种很常见的研究状态：你有不断变化的笔记、实验报告、证据、claim、开放问题，但需要一个轻量结构让人快速理解“现在研究走到哪里了”。结构放在 `graph.yaml`；详细论证和实验内容放在 Markdown 或 HTML；本地私有状态放在 `.side/`。

## 它解决什么问题

- 从 workspace 中的一个或多个 `graph.yaml` 渲染研究图。
- 在 UI 中选择当前 graph，并把选择写入 `.side/config.json`。
- 打开 graph 节点链接的 Markdown、HTML 和纯文本文件。
- Markdown 预览支持内嵌公式和块级 LaTeX。
- 提供 chat/review 界面，让模型在受限 workspace 工具下读取文件、检查论证。
- 将 bundled skills 安装到 `<workspace>/skills`，让 Codex 和 Sidecar 使用同一套研究工作说明。
- 作为 npm CLI 打包：可以全局安装，也可以安装到项目目录；从哪里运行，哪里就是 workspace。

## 仓库结构

```txt
sidecar/              npm 包、Web UI、server、CLI、测试
skills/               bundled workspace skills，由 `research-sidecar install-skills` 复制
research/             demo graph 和 demo 节点文档
docs/                 使用说明和 API 文档
.side/                本地应用状态；不进入 git
```

## 核心模型

运行 `research-sidecar` 的目录就是 workspace。

```txt
my-research-workspace/
  .side/
    config.json       当前 graph、模型设置、session 状态
  skills/
    research-graph-sop/
    scholar-mode/
  dingyi/
    synthetic/
      graph.yaml
      rq.main.md
      reports/
```

graph 文件可以放在 workspace 的任意子目录中。UI 会搜索 `graph.yaml`、`graph.yml`、`*.graph.yaml` 等候选文件。如果存在多个 graph，在 UI 中选择一个并点击 **Save graph**，选择会写入 `.side/config.json`。

graph 里的文件链接默认相对 graph 文件所在目录：

```yaml
file: ./rq.main.md
file: reports/stage1.md
```

只有当你明确想从 workspace 根目录开始寻址时，才使用 `/` 前缀：

```yaml
file: /shared/background.md
```

## 安装和运行

全局安装：

```bash
npm install -g research-sidecar
cd ~/Research/project-a
research-sidecar
```

安装到项目目录：

```bash
cd ~/Research/project-a
npm install -D research-sidecar
npx research-sidecar
```

然后打开：

```txt
http://localhost:4317
```

初始化 workspace：

```bash
research-sidecar init --graph research/graph.yaml
```

安装 bundled skills 到 workspace：

```bash
research-sidecar install-skills
```

## 开发这个仓库

开发应用：

```bash
cd sidecar
npm install
npm run dev
```

验证生产构建和 npm 打包：

```bash
cd sidecar
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

`npm pack --dry-run` 用来确认 npm 包里包含 CLI、编译后的 server、构建后的 client 和 bundled skills。

## 相关文档

- [Sidecar 包 README](sidecar/README.md)
- [使用指南](docs/sidecar-usage.md)
- [API 文档](docs/api.md)

