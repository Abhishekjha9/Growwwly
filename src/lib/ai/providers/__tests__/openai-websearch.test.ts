import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  class MockOpenAI {
    responses = { create: (...args: unknown[]) => createMock(...args) };
  }
  return { ...actual, default: MockOpenAI };
});

const { generateOpenAiWebSearchResponse } = await import("../openai");
const { APIConnectionTimeoutError, APIError } = await import("openai");

const ORIGINAL_ENV = { ...process.env };
const baseOptions = { systemPrompt: "You are a test.", userPrompt: "Find something." };

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  createMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/** Shaped like a real `client.responses.create` result for the `web_search`
 * tool, trimmed to only the fields the extractor reads. */
function response(opts: {
  output_text: string;
  output?: unknown[];
}) {
  return { output_text: opts.output_text, output: opts.output ?? [] };
}

describe("generateOpenAiWebSearchResponse", () => {
  it("1. performs a successful web search and returns the raw text", async () => {
    createMock.mockResolvedValue(response({ output_text: '{"opportunities":[]}' }));

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.text).toBe('{"opportunities":[]}');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("passes the web_search tool and a bounded reasoning effort", async () => {
    createMock.mockResolvedValue(response({ output_text: "{}" }));

    await generateOpenAiWebSearchResponse(baseOptions);

    const [body] = createMock.mock.calls[0];
    expect(body.tools).toEqual([{ type: "web_search", search_context_size: "low" }]);
    expect(body.reasoning).toEqual({ effort: "low" });
    expect(body.include).toContain("web_search_call.action.sources");
  });

  it("2. extracts citations from url_citation annotations on the final message", async () => {
    createMock.mockResolvedValue(
      response({
        output_text: "{}",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "{}",
                annotations: [
                  { type: "url_citation", url: "https://example.com/a", title: "A" },
                  { type: "url_citation", url: "https://example.com/b", title: "B" },
                ],
              },
            ],
          },
        ],
      })
    );

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.citations).toEqual([
      { url: "https://example.com/a", title: "A" },
      { url: "https://example.com/b", title: "B" },
    ]);
  });

  it("3. extracts real URLs from web_search_call action.sources", async () => {
    createMock.mockResolvedValue(
      response({
        output_text: "{}",
        output: [
          {
            type: "web_search_call",
            status: "completed",
            action: {
              type: "search",
              query: "q",
              sources: [
                { type: "url", url: "https://reddit.com/r/foo/comments/1" },
                { type: "url", url: "https://news.ycombinator.com/item?id=1" },
              ],
            },
          },
        ],
      })
    );

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.citations.map((c) => c.url)).toEqual([
      "https://reddit.com/r/foo/comments/1",
      "https://news.ycombinator.com/item?id=1",
    ]);
  });

  it("extracts the URL from an open_page action", async () => {
    createMock.mockResolvedValue(
      response({
        output_text: "{}",
        output: [
          {
            type: "web_search_call",
            status: "completed",
            action: { type: "open_page", url: "https://example.com/thread" },
          },
        ],
      })
    );

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.citations).toEqual([{ url: "https://example.com/thread", title: undefined }]);
  });

  it("de-duplicates the same URL seen via multiple mechanisms", async () => {
    createMock.mockResolvedValue(
      response({
        output_text: "{}",
        output: [
          {
            type: "web_search_call",
            status: "completed",
            action: { type: "search", query: "q", sources: [{ type: "url", url: "https://example.com/x" }] },
          },
          {
            type: "web_search_call",
            status: "completed",
            action: { type: "open_page", url: "https://example.com/x" },
          },
        ],
      })
    );

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.citations).toHaveLength(1);
  });

  it("4. handles a response with no citations at all (search tool found nothing citable)", async () => {
    createMock.mockResolvedValue(response({ output_text: '{"opportunities":[]}', output: [] }));

    const result = await generateOpenAiWebSearchResponse(baseOptions);
    expect(result.citations).toEqual([]);
    expect(result.text).toBe('{"opportunities":[]}');
  });

  it("gives a distinct message on a timeout — not swallowed by the generic APIError branch", async () => {
    // APIConnectionTimeoutError is itself an APIError subclass with
    // status `undefined` and an unmodified `.name` of "Error" — regression
    // test for both of those traps.
    createMock.mockRejectedValue(new APIConnectionTimeoutError());

    await expect(generateOpenAiWebSearchResponse(baseOptions)).rejects.toThrow(/timed out/i);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("passes a longer per-request timeout than the default client timeout (search runs a multi-round tool loop)", async () => {
    createMock.mockResolvedValue(response({ output_text: "{}" }));

    await generateOpenAiWebSearchResponse(baseOptions);

    const [, requestOptions] = createMock.mock.calls[0];
    expect(requestOptions.timeout).toBeGreaterThan(30_000);
  });

  it("8. surfaces a clean error on provider failure without retrying", async () => {
    createMock.mockRejectedValue(
      new APIError(500, { error: { message: "boom" } }, "boom", new Headers())
    );

    await expect(generateOpenAiWebSearchResponse(baseOptions)).rejects.toThrow(
      /server error/i
    );
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the model returns no output text", async () => {
    createMock.mockResolvedValue(response({ output_text: "" }));

    await expect(generateOpenAiWebSearchResponse(baseOptions)).rejects.toThrow(/empty response/i);
  });

  it("never leaks the API key in a thrown error message", async () => {
    createMock.mockRejectedValue(
      new APIError(401, { error: { message: "boom" } }, "boom", new Headers())
    );

    try {
      await generateOpenAiWebSearchResponse(baseOptions);
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain("test-key");
    }
  });
});
