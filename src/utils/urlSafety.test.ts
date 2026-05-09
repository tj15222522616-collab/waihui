import { describe, expect, it } from "vitest";
import { normalizeSafeExternalUrl } from "./urlSafety";

describe("normalizeSafeExternalUrl", () => {
  it("allows http and https urls", () => {
    expect(normalizeSafeExternalUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizeSafeExternalUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects non-web schemes", () => {
    expect(() => normalizeSafeExternalUrl("file:///etc/passwd")).toThrow("仅允许打开");
    expect(() => normalizeSafeExternalUrl("javascript:alert(1)")).toThrow("仅允许打开");
  });
});
