import { useEffect, useState } from "react";
import type { AppSettings, RuntimePoolSnapshot } from "@/types";
import {
  getRuntimePoolSnapshot,
  mutateRuntimePool,
} from "../../../../../services/tauri";

type RuntimePoolSectionProps = {
  t: (key: string, options?: Record<string, unknown>) => string;
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
};

export function RuntimePoolSection({
  t,
  appSettings,
  onUpdateAppSettings,
}: RuntimePoolSectionProps) {
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimePoolSnapshot | null>(null);
  const [runtimeLoading, setRuntimeLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const [hotDraft, setHotDraft] = useState(String(appSettings.codexMaxHotRuntimes ?? 1));
  const [warmDraft, setWarmDraft] = useState(String(appSettings.codexMaxWarmRuntimes ?? 1));
  const [ttlDraft, setTtlDraft] = useState(String(appSettings.codexWarmTtlSeconds ?? 90));

  useEffect(() => {
    setHotDraft(String(appSettings.codexMaxHotRuntimes ?? 1));
    setWarmDraft(String(appSettings.codexMaxWarmRuntimes ?? 1));
    setTtlDraft(String(appSettings.codexWarmTtlSeconds ?? 90));
  }, [
    appSettings.codexMaxHotRuntimes,
    appSettings.codexMaxWarmRuntimes,
    appSettings.codexWarmTtlSeconds,
  ]);

  useEffect(() => {
    let cancelled = false;
    const loadSnapshot = async () => {
      setRuntimeLoading(true);
      setRuntimeError(null);
      try {
        const snapshot = await getRuntimePoolSnapshot();
        if (!cancelled) {
          setRuntimeSnapshot(snapshot);
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setRuntimeLoading(false);
        }
      }
    };
    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshRuntimeSnapshot = async () => {
    setRuntimeLoading(true);
    setRuntimeError(null);
    try {
      setRuntimeSnapshot(await getRuntimePoolSnapshot());
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuntimeLoading(false);
    }
  };

  const handleRuntimeMutation = async (
    action: "close" | "releaseToCold" | "pin",
    workspaceId: string,
    pinned?: boolean,
  ) => {
    setRuntimeSaving(true);
    setRuntimeError(null);
    try {
      const snapshot = await mutateRuntimePool({ action, workspaceId, pinned });
      setRuntimeSnapshot(snapshot);
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuntimeSaving(false);
    }
  };

  const handleSaveRuntimeSettings = async () => {
    const nextHot = Number.parseInt(hotDraft, 10);
    const nextWarm = Number.parseInt(warmDraft, 10);
    const nextTtl = Number.parseInt(ttlDraft, 10);
    setRuntimeSaving(true);
    setRuntimeError(null);
    try {
      await onUpdateAppSettings({
        ...appSettings,
        codexMaxHotRuntimes: Number.isFinite(nextHot)
          ? Math.max(0, Math.min(8, nextHot))
          : 1,
        codexMaxWarmRuntimes: Number.isFinite(nextWarm)
          ? Math.max(0, Math.min(16, nextWarm))
          : 1,
        codexWarmTtlSeconds: Number.isFinite(nextTtl)
          ? Math.max(15, Math.min(3600, nextTtl))
          : 90,
      });
      await refreshRuntimeSnapshot();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error));
    } finally {
      setRuntimeSaving(false);
    }
  };

  return (
    <div className="settings-field">
      <div className="settings-field-label">{t("settings.runtimePoolTitle")}</div>
      <div className="settings-help">{t("settings.runtimePoolDescription")}</div>
      <div className="settings-field-row">
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={appSettings.runtimeRestoreThreadsOnlyOnLaunch !== false}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                runtimeRestoreThreadsOnlyOnLaunch: event.target.checked,
              })
            }
          />
          <span>{t("settings.runtimeRestoreThreadsOnlyOnLaunch")}</span>
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={appSettings.runtimeForceCleanupOnExit !== false}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                runtimeForceCleanupOnExit: event.target.checked,
              })
            }
          />
          <span>{t("settings.runtimeForceCleanupOnExit")}</span>
        </label>
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={appSettings.runtimeOrphanSweepOnLaunch !== false}
            onChange={(event) =>
              void onUpdateAppSettings({
                ...appSettings,
                runtimeOrphanSweepOnLaunch: event.target.checked,
              })
            }
          />
          <span>{t("settings.runtimeOrphanSweepOnLaunch")}</span>
        </label>
      </div>
      <div className="settings-field-row">
        <input
          className="settings-input"
          value={hotDraft}
          onChange={(event) => setHotDraft(event.target.value)}
          placeholder={t("settings.runtimeMaxHot")}
        />
        <input
          className="settings-input"
          value={warmDraft}
          onChange={(event) => setWarmDraft(event.target.value)}
          placeholder={t("settings.runtimeMaxWarm")}
        />
        <input
          className="settings-input"
          value={ttlDraft}
          onChange={(event) => setTtlDraft(event.target.value)}
          placeholder={t("settings.runtimeWarmTtl")}
        />
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void handleSaveRuntimeSettings();
          }}
          disabled={runtimeSaving}
        >
          {runtimeSaving ? t("settings.running") : t("common.save")}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void refreshRuntimeSnapshot();
          }}
          disabled={runtimeLoading}
        >
          {t("settings.refresh")}
        </button>
      </div>
      {runtimeError ? (
        <div className="settings-help" style={{ color: "var(--danger-text, #dc2626)" }}>
          {runtimeError}
        </div>
      ) : null}
      {runtimeSnapshot ? (
        <div className="settings-doctor ok">
          <div className="settings-doctor-title">{t("settings.runtimePoolSummary")}</div>
          <div className="settings-doctor-body">
            <div>
              {t("settings.runtimeSummaryLine", {
                total: runtimeSnapshot.summary.totalRuntimes,
                hot: runtimeSnapshot.summary.hotRuntimes,
                warm: runtimeSnapshot.summary.warmRuntimes,
                busy: runtimeSnapshot.summary.busyRuntimes,
                pinned: runtimeSnapshot.summary.pinnedRuntimes,
              })}
            </div>
            <div>
              {t("settings.runtimeDiagnosticsLine", {
                cleaned: runtimeSnapshot.diagnostics.orphanEntriesCleaned,
                failed: runtimeSnapshot.diagnostics.orphanEntriesFailed,
                forced: runtimeSnapshot.diagnostics.forceKillCount,
              })}
            </div>
            {runtimeSnapshot.rows.length === 0 ? (
              <div>{t("settings.runtimePoolEmpty")}</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {runtimeSnapshot.rows.map((row) => (
                  <div
                    key={`${row.engine}:${row.workspaceId}`}
                    style={{
                      border: "1px solid var(--border, rgba(255,255,255,0.12))",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {row.workspaceName} · {row.engine}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {row.state}
                          {row.pid ? ` · pid ${row.pid}` : ""}
                          {row.wrapperKind ? ` · ${row.wrapperKind}` : ""}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {row.workspacePath}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {row.leaseSources.join(" · ")}
                        </div>
                        {row.error ? (
                          <div style={{ fontSize: 12, color: "var(--danger-text, #dc2626)" }}>
                            {row.error}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            void handleRuntimeMutation("pin", row.workspaceId, !row.pinned);
                          }}
                          disabled={runtimeSaving}
                        >
                          {row.pinned
                            ? t("settings.runtimeUnpin")
                            : t("settings.runtimePin")}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            void handleRuntimeMutation("releaseToCold", row.workspaceId);
                          }}
                          disabled={runtimeSaving}
                        >
                          {t("settings.runtimeRelease")}
                        </button>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            void handleRuntimeMutation("close", row.workspaceId);
                          }}
                          disabled={runtimeSaving}
                        >
                          {t("settings.runtimeClose")}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
