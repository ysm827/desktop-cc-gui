import { useEffect } from "react";
import type { AppSettings } from "../../../types";
import { getVsCodeThemePreset } from "../../theme/constants/vscodeThemePresets";
import { mapVsCodeColorsToTokens } from "../../theme/utils/mapVsCodeColorsToTokens";
import { resolveActiveThemePresetId, resolveEffectiveThemeAppearance } from "../../theme/utils/themePreset";

function applyThemeCssVariables(variableMap: Record<string, string>) {
  if (typeof document === "undefined") {
    return;
  }
  const targets: HTMLElement[] = [
    document.documentElement,
    ...(Array.from(document.querySelectorAll(".app")) as HTMLElement[]),
  ];
  for (const target of targets) {
    for (const [key, value] of Object.entries(variableMap)) {
      target.style.setProperty(key, value);
    }
  }
}

type ThemePreferenceSettings = Pick<
  AppSettings,
  "theme" | "lightThemePresetId" | "darkThemePresetId" | "customThemePresetId"
>;

export function useThemePreference(settings: ThemePreferenceSettings) {
  const theme = settings.theme;
  const lightThemePresetId = settings.lightThemePresetId;
  const darkThemePresetId = settings.darkThemePresetId;
  const customThemePresetId = settings.customThemePresetId;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const media =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const applyThemeState = () => {
      const systemAppearance = media?.matches ? "dark" : "light";
      const appearance = resolveEffectiveThemeAppearance(
        { theme, lightThemePresetId, darkThemePresetId, customThemePresetId },
        systemAppearance,
      );
      if (theme === "system") {
        delete root.dataset.theme;
      } else {
        root.dataset.theme = theme === "custom" ? appearance : theme;
      }
      const presetId = resolveActiveThemePresetId(
        { theme, lightThemePresetId, darkThemePresetId, customThemePresetId },
        systemAppearance,
      );
      const preset = getVsCodeThemePreset(presetId);
      root.dataset.themePreset = preset.id;
      root.dataset.themePresetAppearance = appearance;
      applyThemeCssVariables(mapVsCodeColorsToTokens(preset));
    };

    applyThemeState();

    if (!media) {
      return;
    }
    const handleChange = () => {
      applyThemeState();
    };
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [
    customThemePresetId,
    darkThemePresetId,
    lightThemePresetId,
    theme,
  ]);
}
