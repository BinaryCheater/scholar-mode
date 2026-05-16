import type { ReactNode } from "react";
import type { AppConfig, GraphManifestCandidate } from "../api";

export function GraphSidebarHeader({
  candidates,
  config,
  graphSaving,
  installWorkspaceSkills,
  loadGraphCandidates,
  notice,
  saveGraphSelection,
  selectedCandidate,
  selectedGraphPath,
  setSelectedGraphPath,
  setSidebarCollapsed,
  sidebarCollapsed,
  skillsInstalling,
  viewTabs
}: {
  candidates: GraphManifestCandidate[];
  config: AppConfig | null;
  graphSaving: boolean;
  installWorkspaceSkills: () => void;
  loadGraphCandidates: () => void;
  notice: string;
  saveGraphSelection: () => void;
  selectedCandidate?: GraphManifestCandidate;
  selectedGraphPath: string;
  setSelectedGraphPath: (path: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  sidebarCollapsed: boolean;
  skillsInstalling: boolean;
  viewTabs: ReactNode;
}) {
  return (
    <div className="workspace-sidebar-header">
      {viewTabs}
      <div className="brand-row">
        <div className="workspace-sidebar-title">
          <h1>Research Graph</h1>
          {!sidebarCollapsed && <p>{config?.workspaceRoot || "Loading workspace..."}</p>}
        </div>
        <div className="brand-actions">
          <button className="icon-button" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle sidebar">
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
      </div>
      {!sidebarCollapsed && (
        <div className="graph-config">
          <label>
            Graph
            <select value={selectedGraphPath} onChange={(event) => setSelectedGraphPath(event.target.value)} disabled={!candidates.length}>
              {candidates.length ? (
                candidates.map((candidate) => (
                  <option key={candidate.path} value={candidate.path}>
                    {candidate.title ? `${candidate.title} · ${candidate.path}` : candidate.path}
                  </option>
                ))
              ) : (
                <option value="">No graph found</option>
              )}
            </select>
          </label>
          {selectedCandidate?.error && <small className="graph-config-error">{selectedCandidate.error}</small>}
          {selectedCandidate && !selectedCandidate.error && (
            <small>
              {selectedCandidate.nodeCount ?? 0} nodes · {selectedCandidate.edgeCount ?? 0} edges
            </small>
          )}
          <div className="graph-config-actions">
            <button className="secondary-button compact" onClick={loadGraphCandidates}>
              Refresh
            </button>
            <button className="secondary-button compact" onClick={installWorkspaceSkills} disabled={skillsInstalling}>
              {skillsInstalling ? "Installing" : "Install skills"}
            </button>
            <button className="secondary-button compact primary" onClick={saveGraphSelection} disabled={!selectedGraphPath || selectedGraphPath === config?.graphManifestPath || graphSaving}>
              {graphSaving ? "Saving" : "Save graph"}
            </button>
          </div>
          {notice && <small className="graph-config-notice">{notice}</small>}
        </div>
      )}
    </div>
  );
}
