import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { GraphViewMode, LayoutResearchNode } from "../../lib/researchGraph";
import { allLinkedFilesMissing, firstExistingLinkedFile, linkedFiles, nodeClassName, nodeSubtitle } from "./graphUi";

export type GraphNodeData = {
  item: LayoutResearchNode;
  childCount: number;
  expanded: boolean;
  highlighted: boolean;
  isRoot: boolean;
  mode: GraphViewMode;
} & Record<string, unknown>;

export type ResearchFlowNode = Node<GraphNodeData, "research">;

export function ResearchNodeCard({ data, selected }: NodeProps<ResearchFlowNode>) {
  const item = data.item;

  return (
    <article className={selected ? nodeClassName(item, data.mode, "selected") : nodeClassName(item, data.mode)}>
      <Handle type="target" position={Position.Left} className="node-handle node-handle-left" />
      <Handle type="source" position={Position.Right} className="node-handle node-handle-right" />
      <Handle type="target" position={Position.Top} className="node-handle node-handle-top" />
      <Handle type="source" position={Position.Bottom} className="node-handle node-handle-bottom" />
      {data.mode === "full" ? (
        <FullNodeContent item={item} highlighted={data.highlighted} />
      ) : (
        <CompactNodeContent item={item} />
      )}
      {data.highlighted && <span className="node-match" />}
    </article>
  );
}

export function NodeHoverCard({
  expanded,
  isRoot,
  node,
  canBranch,
  onExpandBranch,
  onFocusSubgraph,
  onMouseEnter,
  onMouseLeave,
  onOpenBrowser,
  onOpenPreview,
  onToggle,
  position,
  style
}: {
  expanded: boolean;
  isRoot: boolean;
  node: LayoutResearchNode;
  canBranch: boolean;
  onExpandBranch: (id: string) => void;
  onFocusSubgraph: (id: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenBrowser: (node: LayoutResearchNode) => void;
  onOpenPreview: (node: LayoutResearchNode) => void;
  onToggle: (id: string) => void;
  position: { x: number; y: number };
  style: CSSProperties;
}) {
  return (
    <div className="node-hover-card" style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} role="dialog" aria-label={node.title}>
      <div className="node-hover-copy">
        <strong>{node.title}</strong>
        <span>
          {node.type}
          {node.status ? ` · ${node.status}` : ""}
        </span>
        {node.summary && <p>{node.summary}</p>}
        <small>{nodeSubtitle(node)}</small>
      </div>
      <NodeActionBar
        canBranch={canBranch}
        canOpen={Boolean(firstExistingLinkedFile(node))}
        expanded={expanded}
        isRoot={isRoot}
        node={node}
        onExpandBranch={onExpandBranch}
        onFocusSubgraph={onFocusSubgraph}
        onOpenBrowser={onOpenBrowser}
        onOpenPreview={onOpenPreview}
        onToggle={onToggle}
      />
    </div>
  );
}

export function NodeContextMenu({
  node,
  onClose,
  onExpandBranch,
  onFocusSubgraph,
  onOpenBrowser,
  onOpenPreview,
  onToggle,
  position
}: {
  node: LayoutResearchNode;
  onClose: () => void;
  onExpandBranch: (id: string) => void;
  onFocusSubgraph: (id: string) => void;
  onOpenBrowser: (node: LayoutResearchNode) => void;
  onOpenPreview: (node: LayoutResearchNode) => void;
  onToggle: (id: string) => void;
  position: { x: number; y: number };
}) {
  const canOpen = Boolean(firstExistingLinkedFile(node));
  const canBranch = Boolean(node);

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <div className="node-context-menu" style={{ left: position.x, top: position.y }} onClick={(event) => event.stopPropagation()}>
      <button onClick={() => run(() => onOpenPreview(node))} disabled={!canOpen && !node.summary}>
        Preview
      </button>
      <button onClick={() => run(() => onOpenBrowser(node))} disabled={!canOpen}>
        Open file
      </button>
      <button onClick={() => run(() => onToggle(node.id))} disabled={!canBranch}>
        Expand / collapse
      </button>
      <button onClick={() => run(() => onExpandBranch(node.id))} disabled={!canBranch}>
        Expand branch
      </button>
      <button onClick={() => run(() => onFocusSubgraph(node.id))}>Focus subgraph</button>
    </div>
  );
}

function NodeActionBar({
  canBranch,
  canOpen,
  expanded,
  isRoot,
  node,
  onExpandBranch,
  onFocusSubgraph,
  onOpenBrowser,
  onOpenPreview,
  onToggle
}: {
  canBranch: boolean;
  canOpen: boolean;
  expanded: boolean;
  isRoot: boolean;
  node: LayoutResearchNode;
  onExpandBranch: (id: string) => void;
  onFocusSubgraph: (id: string) => void;
  onOpenBrowser: (node: LayoutResearchNode) => void;
  onOpenPreview: (node: LayoutResearchNode) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="node-action-bar">
      <button onClick={() => onOpenPreview(node)} disabled={!canOpen && !node.summary}>
        Preview
      </button>
      <button onClick={() => onOpenBrowser(node)} disabled={!canOpen}>
        Open file
      </button>
      <button onClick={() => onToggle(node.id)} disabled={!canBranch}>
        {expanded ? "Collapse" : "Expand"}
      </button>
      <button onClick={() => onExpandBranch(node.id)} disabled={!canBranch}>
        Expand branch
      </button>
      <button onClick={() => onFocusSubgraph(node.id)}>Focus subgraph</button>
    </div>
  );
}

function CompactNodeContent({ item }: { item: LayoutResearchNode }) {
  return (
    <>
      <span className="node-dot" />
      <span className="node-caption">{item.title}</span>
    </>
  );
}

function FullNodeContent({ item, highlighted }: { item: LayoutResearchNode; highlighted: boolean }) {
  return (
    <>
      <header>
        <span className={`node-type type-${item.type}`}>{item.type}</span>
        {item.status && <span className={`node-status status-${item.status}`}>{item.status}</span>}
      </header>
      <h3>{item.title}</h3>
      {item.summary && <p>{item.summary}</p>}
      <footer>
        <span>{nodeSubtitle(item)}</span>
        {allLinkedFilesMissing(item) && <strong>missing files</strong>}
        {linkedFiles(item).length > 1 && <strong>{linkedFiles(item).length} docs</strong>}
        {highlighted && <strong>match</strong>}
      </footer>
    </>
  );
}
