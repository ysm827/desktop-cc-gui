import { Fragment, useMemo, type ReactNode } from "react";

export const PROGRESSIVE_REVEAL_STEP_MS = 28;
export const PROGRESSIVE_REVEAL_CHUNK_CHARS = 360;
const PROGRESSIVE_REVEAL_MIN_CHARS = 96;
const PROGRESSIVE_REVEAL_SMALL_PENDING_CHARS = 140;
const PROGRESSIVE_REVEAL_MAX_CHARS = 720;

export type LightweightMarkdownLinkRenderer = (input: {
  href: string;
  children: ReactNode;
}) => ReactNode;

export function normalizeProgressiveRevealStepMs(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : PROGRESSIVE_REVEAL_STEP_MS;
}

export function normalizeProgressiveRevealChunkChars(value: number) {
  return Number.isFinite(value)
    ? Math.max(PROGRESSIVE_REVEAL_MIN_CHARS, value)
    : PROGRESSIVE_REVEAL_CHUNK_CHARS;
}

function renderInlineLightweightMarkdown(
  text: string,
  renderLink?: LightweightMarkdownLinkRenderer,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(([^)]+)\))/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!linkMatch) {
        nodes.push(token);
      } else {
        const linkChildren = linkMatch[1] ?? "";
        const renderedLink = renderLink?.({
          href: linkMatch[2] ?? "",
          children: linkChildren,
        }) ?? linkChildren;
        nodes.push(<Fragment key={key}>{renderedLink}</Fragment>);
      }
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function splitLightweightHeadingContent(value: string) {
  const separatorMatch = value.match(/^(.{4,64}?[：:])\s*(.{12,})$/u);
  if (!separatorMatch) {
    return {
      headingText: value,
      paragraphText: null,
    };
  }
  return {
    headingText: (separatorMatch[1] ?? value).replace(/[：:]\s*$/u, ""),
    paragraphText: separatorMatch[2] ?? null,
  };
}

export function LightweightMarkdown({
  value,
  renderLink,
}: {
  value: string;
  renderLink?: LightweightMarkdownLinkRenderer;
}) {
  const blocks = useMemo(() => {
    const lines = value.replace(/\r\n/g, "\n").split("\n");
    const result: ReactNode[] = [];
    let paragraphLines: string[] = [];
    let listItems: Array<{ text: string; ordered: boolean }> = [];
    let quoteLines: string[] = [];
    let codeLines: string[] | null = null;

    const flushParagraph = () => {
      if (paragraphLines.length === 0) {
        return;
      }
      const text = paragraphLines.join(" ").trim();
      if (text) {
        result.push(
          <p key={`p-${result.length}`}>
            {renderInlineLightweightMarkdown(text, renderLink)}
          </p>,
        );
      }
      paragraphLines = [];
    };
    const flushList = () => {
      if (listItems.length === 0) {
        return;
      }
      const ordered = listItems.every((item) => item.ordered);
      const children = listItems.map((item, index) => (
        <li key={`li-${index}`}>
          {renderInlineLightweightMarkdown(item.text, renderLink)}
        </li>
      ));
      result.push(
        ordered
          ? <ol key={`ol-${result.length}`}>{children}</ol>
          : <ul key={`ul-${result.length}`}>{children}</ul>,
      );
      listItems = [];
    };
    const flushQuote = () => {
      if (quoteLines.length === 0) {
        return;
      }
      result.push(
        <blockquote key={`quote-${result.length}`}>
          <p>{renderInlineLightweightMarkdown(quoteLines.join(" ").trim(), renderLink)}</p>
        </blockquote>,
      );
      quoteLines = [];
    };
    const flushFlow = () => {
      flushParagraph();
      flushList();
      flushQuote();
    };

    for (const line of lines) {
      if (line.trimStart().startsWith("```")) {
        if (codeLines) {
          result.push(
            <pre key={`pre-${result.length}`}>
              <code>{codeLines.join("\n")}</code>
            </pre>,
          );
          codeLines = null;
        } else {
          flushFlow();
          codeLines = [];
        }
        continue;
      }
      if (codeLines) {
        codeLines.push(line);
        continue;
      }

      const trimmed = line.trim();
      if (!trimmed) {
        flushFlow();
        continue;
      }
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushFlow();
        const level = headingMatch[1].length;
        const headingContent = splitLightweightHeadingContent(headingMatch[2]);
        const children = renderInlineLightweightMarkdown(
          headingContent.headingText,
          renderLink,
        );
        if (level === 1) {
          result.push(<h1 key={`h-${result.length}`}>{children}</h1>);
        } else if (level === 2) {
          result.push(<h2 key={`h-${result.length}`}>{children}</h2>);
        } else if (level === 3) {
          result.push(<h3 key={`h-${result.length}`}>{children}</h3>);
        } else if (level === 4) {
          result.push(<h4 key={`h-${result.length}`}>{children}</h4>);
        } else if (level === 5) {
          result.push(<h5 key={`h-${result.length}`}>{children}</h5>);
        } else {
          result.push(<h6 key={`h-${result.length}`}>{children}</h6>);
        }
        if (headingContent.paragraphText) {
          paragraphLines.push(headingContent.paragraphText);
        }
        continue;
      }
      const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/);
      const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (unorderedMatch || orderedMatch) {
        flushParagraph();
        flushQuote();
        listItems.push({
          text: (unorderedMatch?.[1] ?? orderedMatch?.[1] ?? "").trim(),
          ordered: Boolean(orderedMatch),
        });
        continue;
      }
      if (trimmed.startsWith(">")) {
        flushParagraph();
        flushList();
        quoteLines.push(trimmed.replace(/^>\s?/, ""));
        continue;
      }
      flushList();
      flushQuote();
      paragraphLines.push(trimmed);
    }
    if (codeLines) {
      result.push(
        <pre key={`pre-${result.length}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
    }
    flushFlow();
    return result;
  }, [renderLink, value]);

  return <>{blocks}</>;
}

function findProgressiveRevealBoundary(
  pendingText: string,
  preferredChars: number,
  maxChars: number,
) {
  const normalizedPreferredChars = normalizeProgressiveRevealChunkChars(preferredChars);
  const normalizedMaxChars = Math.max(
    normalizedPreferredChars,
    Math.min(
      Number.isFinite(maxChars) ? maxChars : PROGRESSIVE_REVEAL_MAX_CHARS,
      PROGRESSIVE_REVEAL_MAX_CHARS,
    ),
  );
  const searchEnd = Math.min(pendingText.length, normalizedMaxChars);
  const preferredEnd = Math.min(pendingText.length, normalizedPreferredChars);
  const candidateSlice = pendingText.slice(0, searchEnd);
  const boundaryPatterns = [
    /\n[^\S\r\n]*\n+/g,
    /\n(?=#{1,6}\s)/g,
    /\n(?=(?:[-*+]|\d+[.)])\s+)/g,
    /\n(?=>\s?)/g,
    /\n(?=```)/g,
    /\n/g,
  ];

  for (const pattern of boundaryPatterns) {
    let match: RegExpExecArray | null;
    let selectedBoundary = -1;
    while ((match = pattern.exec(candidateSlice)) !== null) {
      const boundary = match.index + match[0].length;
      if (boundary >= preferredEnd) {
        return boundary;
      }
      if (boundary >= PROGRESSIVE_REVEAL_MIN_CHARS) {
        selectedBoundary = boundary;
      }
    }
    if (selectedBoundary >= PROGRESSIVE_REVEAL_MIN_CHARS) {
      return selectedBoundary;
    }
  }

  return preferredEnd;
}

export function resolveProgressiveRevealValue(
  visibleValue: string,
  targetValue: string,
  preferredChunkChars: number,
) {
  if (visibleValue === targetValue) {
    return visibleValue;
  }
  if (!targetValue.startsWith(visibleValue)) {
    return targetValue;
  }
  const pendingText = targetValue.slice(visibleValue.length);
  if (pendingText.length <= PROGRESSIVE_REVEAL_SMALL_PENDING_CHARS) {
    return targetValue;
  }
  const normalizedChunkChars = normalizeProgressiveRevealChunkChars(preferredChunkChars);
  const boundary = findProgressiveRevealBoundary(
    pendingText,
    normalizedChunkChars,
    Math.max(normalizedChunkChars * 2, PROGRESSIVE_REVEAL_MIN_CHARS),
  );
  return targetValue.slice(0, visibleValue.length + boundary);
}
