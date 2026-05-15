# Research Sidecar

[English](README.md) | 中文

Research Sidecar 是一个用于 graph-backed research workflow 的本地 Web 应用和 npm CLI。它适合和 Codex 一起工作：Codex 可以生成、澄清、修改研究笔记；Research Sidecar 提供可读的研究图、文档预览和明确的 review 界面，帮助人判断这些工作是否合理。

最重要的规则是：**你在哪里运行 `research-sidecar`，哪里就是 workspace**。应用只在这个 workspace 内读写文件，并把私有本地状态保存在 `.side/`。

## 为什么需要它

研究工作通常从模糊问题开始，逐步形成实验、报告、局部结论和修订。如果所有内容只是散落在 Markdown 文件里，人很难快速理解当前状态。Research Sidecar 把研究拆成三层：

- `graph.yaml`：研究结构图，包括问题、方法、claim、证据、任务和输出。
- Markdown/HTML 文件：详细推理、实验报告、表格、公式和草稿。
- `.side/`：本地私有状态，包括当前选择的 graph、session 和 provider 配置。

这样 Codex 有一个明确结构可以维护，人也能通过 UI 快速理解研究进展。

## 安装

全局安装：

```bash
npm install -g @binarycheater/research-sidecar
cd ~/Research/project-a
research-sidecar
```

安装到项目：

```bash
cd ~/Research/project-a
npm install -D @binarycheater/research-sidecar
npx research-sidecar
```

打开：

```txt
http://localhost:4317
```

## CLI 命令

把当前目录作为 workspace 启动：

```bash
research-sidecar
```

本次启动指定 graph：

```bash
research-sidecar --graph dingyi/synthetic/graph.yaml
```

初始化 workspace 状态：

```bash
research-sidecar init --graph research/graph.yaml
```

安装 bundled skills：

```bash
research-sidecar install-skills
```

常用选项：

- `--workspace /path/to/workspace`：不用当前目录，显式指定 workspace。
- `--graph path/to/graph.yaml`：指定 workspace 内的 graph manifest。
- `--port 4317`：指定 HTTP 端口。
- `--force`：覆盖 init 或 install-skills 管理的 starter graph / skill 文件。
- `--no-graph`：只初始化 `.side/`，不创建 starter graph。
- `--no-skills`：只初始化 `.side/`，不复制 bundled skills。

## Workspace 配置

workspace 配置文件位于：

```txt
<workspace>/.side/config.json
```

示例：

```json
{
  "defaultModel": "deepseek-v4-pro",
  "openaiBaseURL": "https://api.deepseek.com",
  "apiMode": "chat",
  "graph": {
    "manifestPath": "dingyi/synthetic/graph.yaml"
  },
  "tools": {
    "allowedWriteExtensions": [".md", ".markdown", ".html", ".htm", ".yaml", ".yml"]
  }
}
```

UI 可以更新 `graph.manifestPath`：在 Graph 面板里选择 graph，然后点击 **Save graph**。这个选择会写入 `.side/config.json`。

`.side/` 不应该进入 git，因为它可能包含 API key 和私有 session 历史。

## Graph 发现和链接规则

应用会在整个 workspace 中搜索 graph 候选：

- `graph.yaml`
- `graph.yml`
- `*.graph.yaml`
- `*.graph.yml`

会跳过依赖和构建目录，例如 `node_modules`、`dist`、`dist-server`、`.git`、`.side`。

如果 workspace 里有多个 graph，在 UI 中选择当前 graph。保存后，选择会持久化到 `.side/config.json`。

graph 里的文件链接默认相对 graph 文件所在目录：

```yaml
nodes:
  - id: rq.main
    title: Main question
    type: question
    file: ./rq.main.md

  - id: evidence.stage1
    title: Stage 1 report
    type: evidence
    file: reports/stage1.md
```

如果 graph 位于 `dingyi/synthetic/graph.yaml`，这些链接会解析成：

```txt
dingyi/synthetic/rq.main.md
dingyi/synthetic/reports/stage1.md
```

如果需要从 workspace 根目录开始寻址，使用 `/` 前缀：

```yaml
file: /shared/background.md
```

服务端返回的路径会统一成 workspace-relative，方便 UI、API 和工具使用同一种路径形式。

## Markdown、HTML 和 LaTeX

Markdown 预览支持：

- GitHub-flavored Markdown
- 表格
- 可读颜色的 fenced code block
- 内嵌公式，例如 `$x_i + y_i$`
- 块级公式，例如：

```md
$$
\sum_i x_i
$$
```

HTML 预览通过 workspace raw-file route 进行加载，因此普通相对链接可以在 workspace 内解析。

## Workspace Skills

Research Sidecar 最好配合 workspace skills 使用：

```bash
research-sidecar install-skills
```

这会把 bundled skills 复制到：

```txt
<workspace>/skills/
```

默认不会覆盖已有 skill 目录。如果你明确想覆盖 install-managed skills，使用 `--force`。

Graph 侧栏里也有 **Install skills** 按钮。安装后，应用会发现 `SKILL.md`，并在 review context 中加载相关指令。

## Provider 配置

环境变量：

- `OPENAI_API_KEY`：模型调用需要。
- `OPENAI_BASE_URL`：可选的 OpenAI-compatible endpoint，例如 `https://api.deepseek.com`。
- `SIDECAR_DEFAULT_MODEL`：默认 `gpt-5.5`。
- `SIDECAR_GRAPH_MANIFEST`：workspace 内的 graph manifest 路径；会覆盖本次运行的 config。
- `SIDECAR_WORKSPACE_ROOT`：workspace root；CLI 通常会用当前目录自动设置。
- `PORT`：默认 `4317`。

官方 OpenAI endpoint 使用 Responses API。非 OpenAI 的 OpenAI-compatible endpoint 使用 Chat Completions。

示例：

```bash
OPENAI_BASE_URL=https://api.deepseek.com \
SIDECAR_DEFAULT_MODEL=deepseek-v4-pro \
research-sidecar
```

## 开发

修改这个源码目录时使用：

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

开发辅助 CLI 仍然可用：

```bash
npm run codex:install -- --workspace /path/to/workspace
npm run codex:call -- --title "Review" --context "Codex summary..." --file research/graph.yaml
npm run codex:ask -- --title "Review" --context "Codex summary..." --question "What is weak?"
```

## 打包

发布或测试本地 tarball 前运行：

```bash
npm pack --dry-run
```

`prepack` 会构建 client 和 server，然后把 bundled skills 复制进包里。npm 包包含：

- `bin/research-sidecar.mjs`
- `dist/client`
- `dist-server`
- `skills/research-graph-sop`
- `skills/scholar-mode`
- `skills/sidecar-thinking`
- `skills/writing-explanatory-reports`
- CLI helper scripts
- README files
