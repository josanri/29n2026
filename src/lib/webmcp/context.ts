/**
 * WebMCP: the page offers tools that the AI agent of the browser can call (https://webmachinelearning.github.io/webmcp/).
 * The API is experimental. The specification puts it in `document.modelContext`; the first versions of Chrome put it
 * in `navigator.modelContext`. This module finds either one, and does nothing in a browser that has neither.
 *
 * This file is small on purpose: every page imports it to decide whether to load the tools (`tools.ts`).
 */

/** What the agent receives when it calls a tool: any value that can be written as JSON. */
export type ToolResult = unknown;

export interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: object;
  execute: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
  annotations?: {
    /** The tool reads and changes nothing. */
    readOnlyHint?: boolean;
    /** The result has text that the site does not write (here, the programs of the parties). */
    untrustedContentHint?: boolean;
  };
}

interface ModelContext {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): Promise<void> | void;
}

export function modelContext(): ModelContext | undefined {
  const fromDocument = (document as Document & { modelContext?: ModelContext }).modelContext;
  const fromNavigator = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
  return fromDocument ?? fromNavigator;
}

/**
 * A mistake of the agent (a party or a value that does not exist) comes back as `{ error }`, with the message that
 * says how to fix it. A thrown error would reach the agent only as «the invocation failed».
 */
const withErrorResult = (tool: WebMcpTool): WebMcpTool => ({
  ...tool,
  async execute(input) {
    try {
      return await tool.execute(input ?? {});
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});

/**
 * Registers the tools. A tool that fails (an old version of the API, a name already taken) does not stop the others,
 * and never breaks the page.
 */
export async function registerTools(tools: WebMcpTool[], signal?: AbortSignal) {
  const context = modelContext();
  if (!context) return;
  for (const tool of tools) {
    try {
      await context.registerTool(withErrorResult(tool), signal ? { signal } : undefined);
    } catch (error) {
      console.warn(`[webmcp] No se pudo registrar «${tool.name}»`, error);
    }
  }
}
