import test from "node:test";
import assert from "node:assert/strict";
import { parseVitestBatchConfig } from "./test-batched.mjs";

test("enables heavy integration suites via explicit CLI flag", () => {
  const config = parseVitestBatchConfig(["--include-heavy"], {
    VITEST_BATCH_SIZE: "6",
  });

  assert.deepEqual(config, {
    batchSize: 6,
    includeHeavyIntegration: true,
  });
});

test("keeps env-based heavy integration fallback for CI callers", () => {
  const config = parseVitestBatchConfig([], {
    VITEST_BATCH_SIZE: "4",
    VITEST_INCLUDE_HEAVY: "1",
  });

  assert.deepEqual(config, {
    batchSize: 4,
    includeHeavyIntegration: true,
  });
});

test("rejects unsupported CLI arguments", () => {
  assert.throws(
    () => parseVitestBatchConfig(["--unknown"], { VITEST_BATCH_SIZE: "4" }),
    /Unknown argument: --unknown/,
  );
});
