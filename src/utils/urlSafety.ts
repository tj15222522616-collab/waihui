export const normalizeSafeExternalUrl = (url: string) => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("链接格式无效，无法打开。");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("仅允许打开 http 或 https 链接。");
  }

  return parsed.toString();
};
