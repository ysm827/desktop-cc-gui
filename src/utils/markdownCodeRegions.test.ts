import { describe, expect, it } from "vitest";
import { normalizeOutsideMarkdownCode } from "./markdownCodeRegions";

describe("markdownCodeRegions", () => {
  it("does not replace literal token-shaped text outside inline code", () => {
    const source = "outside CCGUIINLINECODETOKEN0 `pnpm lint` tail";

    const normalized = normalizeOutsideMarkdownCode(source, (segment) =>
      segment.replace("outside", "updated"),
    );

    expect(normalized).toBe("updated CCGUIINLINECODETOKEN0 `pnpm lint` tail");
  });
});
