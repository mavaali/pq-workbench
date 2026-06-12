import * as React from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

// The bottom edge narrates system state: connection, identity, role,
// last-run stats, export. One component retires four "state exists but
// isn't narrated" findings.

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "4px 14px",
    backgroundColor: tokens.colorNeutralBackground2,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: "11px",
    color: tokens.colorNeutralForeground3,
    userSelect: "none",
  },
  connected: { color: tokens.colorBrandForeground1 },
  disconnected: { color: tokens.colorPaletteRedForeground1 },
  spacer: { flex: 1 },
  stat: { color: tokens.colorNeutralForeground2 },
  action: {
    cursor: "pointer",
    ":hover": { color: tokens.colorNeutralForeground1 },
  },
});

export interface StatusBarProps {
  connected: boolean;
  identity?: string; // "mihir@contoso.com"
  role?: "contributor" | "viewer" | "unknown";
  lastRun?: { rows: number; durationMs: number };
  onExportCsv?: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const s = useStyles();
  const { connected, identity, role, lastRun, onExportCsv } = props;

  return (
    <div className={s.root}>
      <span className={connected ? s.connected : s.disconnected}>
        {connected ? "\u25CF connected" : "\u25CF offline"}
      </span>
      {identity && (
        <span>
          {identity}
          {role && role !== "unknown" ? ` \u00B7 ${role}` : ""}
        </span>
      )}
      <span className={s.spacer} />
      {lastRun && (
        <>
          <span className={s.stat}>
            {lastRun.rows.toLocaleString()} {lastRun.rows === 1 ? "row" : "rows"}
          </span>
          <span className={s.stat}>
            {(lastRun.durationMs / 1000).toFixed(2)}s round-trip
          </span>
        </>
      )}
      {lastRun && onExportCsv && (
        <span
          className={s.action}
          role="button"
          tabIndex={0}
          onClick={onExportCsv}
          onKeyDown={(e) => e.key === "Enter" && onExportCsv()}
        >
          CSV
        </span>
      )}
    </div>
  );
}
