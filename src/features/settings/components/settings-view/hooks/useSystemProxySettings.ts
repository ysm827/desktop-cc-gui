import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@/types";
import { pushErrorToast } from "@/services/toasts";

type InlineNoticeState =
  | {
      kind: "success" | "error";
      message: string;
    }
  | null;

type TranslateFn = (key: string) => string;

type UseSystemProxySettingsInput = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  t: TranslateFn;
};

export function useSystemProxySettings({
  appSettings,
  onUpdateAppSettings,
  t,
}: UseSystemProxySettingsInput) {
  const [systemProxyEnabledDraft, setSystemProxyEnabledDraft] = useState(
    appSettings.systemProxyEnabled ?? false,
  );
  const [systemProxyUrlDraft, setSystemProxyUrlDraft] = useState(
    appSettings.systemProxyUrl ?? "",
  );
  const [systemProxyError, setSystemProxyError] = useState<string | null>(null);
  const [systemProxyNotice, setSystemProxyNotice] = useState<InlineNoticeState>(null);
  const [systemProxySaving, setSystemProxySaving] = useState(false);

  useEffect(() => {
    setSystemProxyEnabledDraft(appSettings.systemProxyEnabled ?? false);
    setSystemProxyUrlDraft(appSettings.systemProxyUrl ?? "");
    setSystemProxyError(null);
  }, [appSettings.systemProxyEnabled, appSettings.systemProxyUrl]);

  useEffect(() => {
    if (!systemProxyNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSystemProxyNotice(null);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [systemProxyNotice]);

  const updateSystemProxySettings = useCallback(
    async (
      nextEnabled: boolean,
      nextProxyUrl: string,
      successMessage: string,
      rollbackDraft: {
        enabled: boolean;
        proxyUrl: string;
      },
    ) => {
      const trimmedProxyUrl = nextProxyUrl.trim();
      if (nextEnabled && !trimmedProxyUrl) {
        const message = t("settings.behaviorProxyRequired");
        setSystemProxyEnabledDraft(rollbackDraft.enabled);
        setSystemProxyUrlDraft(rollbackDraft.proxyUrl);
        setSystemProxyError(message);
        setSystemProxyNotice(null);
        return false;
      }

      setSystemProxySaving(true);
      setSystemProxyError(null);
      setSystemProxyNotice(null);
      try {
        await onUpdateAppSettings({
          ...appSettings,
          systemProxyEnabled: nextEnabled,
          systemProxyUrl: trimmedProxyUrl || null,
        });
        setSystemProxyNotice({
          kind: "success",
          message: successMessage,
        });
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setSystemProxyEnabledDraft(rollbackDraft.enabled);
        setSystemProxyUrlDraft(rollbackDraft.proxyUrl);
        setSystemProxyError(message);
        setSystemProxyNotice(null);
        pushErrorToast({
          title: t("common.error"),
          message,
        });
        return false;
      } finally {
        setSystemProxySaving(false);
      }
    },
    [appSettings, onUpdateAppSettings, t],
  );

  const handleSaveSystemProxy = useCallback(async () => {
    await updateSystemProxySettings(
      systemProxyEnabledDraft,
      systemProxyUrlDraft,
      t("settings.behaviorProxySaved"),
      {
        enabled: appSettings.systemProxyEnabled ?? false,
        proxyUrl: appSettings.systemProxyUrl ?? "",
      },
    );
  }, [
    appSettings.systemProxyEnabled,
    appSettings.systemProxyUrl,
    systemProxyEnabledDraft,
    systemProxyUrlDraft,
    t,
    updateSystemProxySettings,
  ]);

  const handleToggleSystemProxy = useCallback(
    (checked: boolean) => {
      if (systemProxySaving) {
        return;
      }
      const rollbackDraft = {
        enabled: appSettings.systemProxyEnabled ?? false,
        proxyUrl: appSettings.systemProxyUrl ?? "",
      };
      const nextProxyUrl = checked
        ? systemProxyUrlDraft
        : (systemProxyUrlDraft.trim() || rollbackDraft.proxyUrl);

      setSystemProxyEnabledDraft(checked);
      setSystemProxyError(null);
      setSystemProxyNotice(null);

      void updateSystemProxySettings(
        checked,
        nextProxyUrl,
        checked
          ? t("settings.behaviorProxyEnabledSuccess")
          : t("settings.behaviorProxyDisabledSuccess"),
        rollbackDraft,
      );
    },
    [
      appSettings.systemProxyEnabled,
      appSettings.systemProxyUrl,
      systemProxySaving,
      systemProxyUrlDraft,
      t,
      updateSystemProxySettings,
    ],
  );

  const handleSystemProxyUrlChange = useCallback((value: string) => {
    setSystemProxyUrlDraft(value);
    setSystemProxyError(null);
    setSystemProxyNotice(null);
  }, []);

  const systemProxyDirty =
    (appSettings.systemProxyEnabled ?? false) !== systemProxyEnabledDraft ||
    (appSettings.systemProxyUrl ?? "") !== systemProxyUrlDraft;

  return {
    handleSaveSystemProxy,
    handleSystemProxyUrlChange,
    handleToggleSystemProxy,
    systemProxyDirty,
    systemProxyEnabledDraft,
    systemProxyError,
    systemProxyNotice,
    systemProxySaving,
    systemProxyUrlDraft,
  };
}
