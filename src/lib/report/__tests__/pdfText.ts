import { inflateSync } from "node:zlib";

/**
 * Best-effort text extraction from a react-pdf/pdfkit-generated PDF buffer —
 * test-only tooling, not a general PDF parser. It inflates each FlateDecode
 * content stream and pulls the literal strings out of `Tj`/`TJ` text-showing
 * operators, in file order (which for pdfkit's sequential object writer
 * matches page/render order). pdfkit encodes simple (non-embedded) fonts
 * like Helvetica as hex strings (`<48656c6c6f>`), one hex run per
 * kerning-adjusted chunk — concatenating the decoded bytes in order
 * reconstructs the original text exactly, with no separator needed.
 *
 * Good enough to assert that specific values from an `AnalysisResult`
 * actually reached the rendered PDF, not just that they were passed as
 * React props.
 */
export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw))) {
    try {
      chunks.push(inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"));
    } catch {
      // Not a Flate-compressed stream (e.g. an embedded image) — skip it.
    }
  }
  return chunks.map(extractOperatorStrings).join("");
}

function extractOperatorStrings(content: string): string {
  const out: string[] = [];

  // Single-string operators: (literal) Tj  or  <hex> Tj
  const tjRe = /(?:\(((?:\\.|[^()\\])*)\)|<([0-9A-Fa-f\s]*)>)\s*Tj/g;
  let match: RegExpExecArray | null;
  while ((match = tjRe.exec(content))) {
    out.push(match[1] !== undefined ? unescapePdfString(match[1]) : hexToStr(match[2]));
  }

  // Kerning arrays: [ (lit) num <hex> num ... ] TJ
  const tjArrayRe = /\[((?:\\.|[^[\]\\])*)\]\s*TJ/g;
  while ((match = tjArrayRe.exec(content))) {
    const partRe = /\(((?:\\.|[^()\\])*)\)|<([0-9A-Fa-f\s]*)>/g;
    let part: RegExpExecArray | null;
    while ((part = partRe.exec(match[1]))) {
      out.push(part[1] !== undefined ? unescapePdfString(part[1]) : hexToStr(part[2]));
    }
  }
  return out.join("");
}

function hexToStr(hex: string): string {
  return Buffer.from(hex.replace(/\s+/g, ""), "hex").toString("latin1");
}

function unescapePdfString(s: string): string {
  return s.replace(/\\(\d{1,3}|.)/g, (_, esc: string) => {
    if (/^[0-7]{1,3}$/.test(esc)) return String.fromCharCode(parseInt(esc, 8));
    if (esc === "n") return "\n";
    if (esc === "r") return "\r";
    if (esc === "t") return "\t";
    return esc;
  });
}
