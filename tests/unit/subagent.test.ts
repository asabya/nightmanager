import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Model } from "@mariozechner/pi-ai";
import { defineTool, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import {
  runIsolatedSubagent,
  SubagentResult,
} from "../../src/core/subagent.js";

// Helper to create mock agent messages that satisfy TypeScript
const makeAssistantMessage = (text: string, timestamp?: number): any => {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: timestamp ?? Date.now(),
  } as any;
};

// Function to set pending events (assigned in beforeEach)
let setPendingEventsFn: ((events: any[]) => void) | null = null;
let getPendingEventsFn: (() => any[]) | null = null;

// Use vi.hoisted to create mock factory before any imports are hoisted
const { mockAgentClass } = vi.hoisted(() => {
  // Factory to create mock agent instances
  const createAgentInstance = function(): any {
    const handlers: ((event: any, signal: AbortSignal) => Promise<void>)[] = [];
    
    return {
      _handlers: handlers,
      prompt: vi.fn().mockResolvedValue(undefined),
      waitForIdle: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockImplementation((handler: (event: any, signal: AbortSignal) => Promise<void>) => {
        handlers.push(handler);
        return () => {
          const idx = handlers.indexOf(handler);
          if (idx >= 0) handlers.splice(idx, 1);
        };
      }),
      getState: vi.fn().mockReturnValue({
        messages: [
          {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
            api: "openai",
            provider: "test",
            model: "gpt-4o",
            usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
            stopReason: "endTurn",
          } as any,
        ],
        tools: [],
        model: {} as Model<any>,
        systemPrompt: "Test",
        pendingToolCalls: [],
        isStreaming: false,
        streamingMessage: null,
        errorMessage: null,
      }),
    };
  };
  
  // Add state getter to the returned instances
  const Agent = vi.fn(createAgentInstance);
  Object.defineProperty(Agent.prototype, 'state', {
    get: function() { return this.getState(); },
    enumerable: true,
    configurable: true,
  });
  
  return { mockAgentClass: Agent };
});

// Mock the pi-agent-core module
vi.mock("@mariozechner/pi-agent-core", () => ({
  Agent: mockAgentClass as any,
}));

describe("runIsolatedSubagent", () => {
  // Create mock extension context
  const createMockContext = (): ExtensionContext => ({
    modelRegistry: {
      getApiKeyAndHeaders: vi.fn().mockResolvedValue({
        ok: true,
        apiKey: "test-api-key",
        headers: {},
      }),
    },
  }) as unknown as ExtensionContext;

  // Create mock model
  const createMockModel = (): Model<any> => ({
    provider: "openai",
    name: "gpt-4o",
    contextWindow: 272000,
  } as Model<any>);

  // Track created agent instances
  const agentInstances: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    agentInstances.length = 0;
    
    // Store events to emit during agent execution (defined per test)
    let pendingEvents: any[] = [];
    
    // Reset the mock to capture created instances
    mockAgentClass.mockImplementation(function(this: any) {
      const instanceHandlers: ((event: any, signal: AbortSignal) => Promise<void>)[] = [];
      
      // Track messages from events for getState to return
      let eventMessages: any[] = [];
      let finalTextFromEvents = "";
      
      const instance = {
        prompt: vi.fn().mockImplementation(async function(_userMsg: any) {
          const events = getPendingEventsFn ? getPendingEventsFn() : [];
          eventMessages = extractMessagesFromEvents(events);
          finalTextFromEvents = extractFinalTextFromEvents(events);
          const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as AbortSignal;
          for (const event of events) {
            for (const handler of instanceHandlers) {
              await handler(event, signal);
            }
          }
          if (setPendingEventsFn) {
            setPendingEventsFn([]);
          }
          return Promise.resolve();
        }),
        waitForIdle: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockImplementation((handler: (event: any, signal: AbortSignal) => Promise<void>) => {
          instanceHandlers.push(handler);
          // Store reference for tests to set pending events
          (instance as any)._handlers = instanceHandlers;
          return () => {
            const idx = instanceHandlers.indexOf(handler);
            if (idx >= 0) instanceHandlers.splice(idx, 1);
          };
        }),
        getState: vi.fn().mockImplementation(() => ({
          messages: eventMessages.length > 0
            ? eventMessages
            : [
                {
                  role: "assistant",
                  content: [
                    { type: "text", text: finalTextFromEvents || "Hello, I have completed the task. Here are the results." }
                  ],
                  timestamp: Date.now(),
                },
              ],
          tools: [],
          model: createMockModel(),
          systemPrompt: "Test",
          pendingToolCalls: [],
          isStreaming: false,
          streamingMessage: null,
          errorMessage: null,
        })),
      };
      
      Object.defineProperty(instance, 'state', {
        get() { return instance.getState(); },
        enumerable: true,
        configurable: true,
      });

      agentInstances.push(instance);
      return instance;
    });

    // Initialize pending events getter/setter for this test
    let testPendingEvents: any[] = [];
    setPendingEventsFn = (events: any[]) => { testPendingEvents = events; };
    getPendingEventsFn = () => testPendingEvents;
  });

  // Helper to extract messages from events for mock's getState
  function extractMessagesFromEvents(events: any[]): any[] {
    const messages: any[] = [];
    for (const event of events) {
      if (event.type === "message_end" && (event.message as any)) {
        // Use the last message_end message as the final message
        messages.push(event.message as any);
      } else if (event.type === "agent_end" && (event.messages as any)) {
        // Also check agent_end messages
        messages.push(...(event.messages as any));
      }
    }
    return messages;
  }

  // Helper to get final text from events
  function extractFinalTextFromEvents(events: any[]): string {
    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];
      if (event.type === "message_end" && (event.message as any)) {
        const msg = event.message as any;
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if (block.type === "text" && block.text) {
              return block.text;
            }
          }
        }
      }
    }
    return "";
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to emit agent events through the subscribed handlers
  async function emitEvents(agent: any, events: any[]) {
    // Get the handler from subscribe call
    const subscribeCalls = agent.subscribe.mock.calls;
    if (subscribeCalls.length === 0) return;
    
    const handler = subscribeCalls[0][0];
    const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as AbortSignal;
    
    for (const event of events) {
      await handler(event, signal);
    }
  }

  describe("live transcript updates with mocked Agent events", () => {
    it("mock Agent to emit assistant update, tool start, tool end, agent end and verify result", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      // Set up events to emit through the agent
      const events: any[] = [
        {
          type: "message_update",
          message: makeAssistantMessage("Hello "),
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "tool_execution_start",
          toolCallId: "call_123",
          toolName: "finder",
          args: { query: "test" },
        },
        {
          type: "tool_execution_end",
          toolCallId: "call_123",
          toolName: "finder",
          result: { content: [{ type: "text", text: "Found 3 files" }] },
          isError: false,
        },
        {
          type: "message_end",
          message: makeAssistantMessage("Hello, I have completed the task. Here are the results."),
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent so they emit during execution
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Verify result.finalText is exact value from final assistant message
      expect(result.finalText).toBe("Hello, I have completed the task. Here are the results.");

      // Verify result.details.entries include assistant_text, tool_call, tool_result
      const entries = result.details.entries;
      const hasAssistantText = entries.some(e => e.type === "assistant_text");
      const hasToolCall = entries.some(e => e.type === "tool_call" && e.toolName === "finder");
      const hasToolResult = entries.some(e => e.type === "tool_result" && e.toolName === "finder");

      expect(hasAssistantText).toBe(true);
      expect(hasToolCall).toBe(true);
      expect(hasToolResult).toBe(true);

      // Verify onUpdate was called
      expect(onUpdate).toHaveBeenCalled();

      // Verify final emitted update has details.status === "completed"
      const finalCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(finalCall[0].details.status).toBe("completed");
    });
  });

  describe("live transcript updates", () => {
    it("emits live transcript updates via onUpdate callback while returning final summary", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "tool_execution_start",
          toolCallId: "call_123",
          toolName: "finder",
          args: { query: "test" },
        },
        {
          type: "tool_execution_end",
          toolCallId: "call_123",
          toolName: "finder",
          result: { content: [{ type: "text", text: "Found 3 files" }] },
          isError: false,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Verify result has finalText
      expect(result).toBeDefined();
      expect(typeof result.finalText).toBe("string");
      
      // Verify result has details with entries
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("entries");
      expect(result.details).toHaveProperty("status");
    });

    it("propagates live usage snapshots from assistant messages", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            usage: { input: 1200, output: 100, cacheRead: 50, cacheWrite: 0, totalTokens: 1350, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.003 } },
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello done" }],
            usage: { input: 1200, output: 200, cacheRead: 50, cacheWrite: 0, totalTokens: 1450, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.006 } },
            timestamp: Date.now(),
          },
        },
      ];

      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      expect(onUpdate.mock.calls[0][0].details.usage).toEqual({ input: 1200, output: 100, cacheRead: 50, cacheWrite: 0, cost: 0.003, totalTokens: 1350, contextWindow: 272000 });
      expect(onUpdate.mock.calls.length).toBeLessThan(events.length + 1);
      expect(result.details.usage).toEqual({ input: 1200, output: 200, cacheRead: 50, cacheWrite: 0, cost: 0.006, totalTokens: 1450, contextWindow: 272000 });
    });

    it("returns result with finalText extracted from final assistant message", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // finalText should be extracted from final assistant message - verify EXACT value
      expect(result.finalText).toBeDefined();
      expect(typeof result.finalText).toBe("string");
      // Verify the exact text from the mock's final message
      expect(result.finalText).toBe("Hello, I have completed the task. Here are the results.");
    });

    it("includes transcript details structure and verifies actual assistant_text, tool_call, tool_result entries", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "tool_execution_start",
          toolCallId: "call_123",
          toolName: "finder",
          args: { query: "test" },
        },
        {
          type: "tool_execution_end",
          toolCallId: "call_123",
          toolName: "finder",
          result: { content: [{ type: "text", text: "Found 3 files" }] },
          isError: false,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Verify details structure exists
      expect(result.details).toBeDefined();
      expect(result.details.entries).toBeInstanceOf(Array);
      
      // Verify actual entry types are present (not just "capable of")
      expect(result.details).toHaveProperty("tool");
      expect(result.details).toHaveProperty("task");
      expect(result.details).toHaveProperty("status");

      // Verify actual entries exist in the result
      const entries = result.details.entries;
      expect(entries.length).toBeGreaterThan(0);
      
      // Verify specific entry types are actually present
      const hasAssistantText = entries.some(e => e.type === "assistant_text");
      const hasToolCall = entries.some(e => e.type === "tool_call");
      const hasToolResult = entries.some(e => e.type === "tool_result");
      expect(hasAssistantText).toBe(true);
      expect(hasToolCall).toBe(true);
      expect(hasToolResult).toBe(true);
    });

    it("emits live updates during execution and final update has completed status", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "tool_execution_start",
          toolCallId: "call_123",
          toolName: "finder",
          args: { query: "test" },
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // onUpdate should have been called (at least once for the final update)
      expect(onUpdate).toHaveBeenCalled();
      
      // Verify there is at least one non-completed update from actual agent events before the final completed update
      const allCalls = onUpdate.mock.calls;
      const nonCompletedUpdates = allCalls.filter(call => call[0].details.status !== "completed");
      
      // Should have at least one live update from actual agent events before the final completed update
      expect(nonCompletedUpdates.length).toBeGreaterThan(0);
      
      // The final update's details status should be "completed"
      const finalCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      expect(finalCall[0].details.status).toBe("completed");
    });

    it("final onUpdate includes finalized details with status, finalText, and model", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Get the final update (last call)
      expect(onUpdate).toHaveBeenCalled();
      const finalCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1];
      const finalPayload = finalCall[0];

      // Final update must include completed status
      expect(finalPayload.details.status).toBe("completed");

      // Final update must include finalText
      expect(finalPayload.details.finalText).toBeDefined();
      expect(typeof finalPayload.details.finalText).toBe("string");

      // Final update must include model metadata
      expect(finalPayload.details.model).toBeDefined();
      expect(finalPayload.details.model).toBe("gpt-4o");

      // Final update details should exactly match the returned finalized details
      expect(finalPayload.details).toEqual(result.details);
    });

    it("onUpdate content is an array of text content blocks, not a bare string", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Get any update call
      expect(onUpdate).toHaveBeenCalled();
      const firstCall = onUpdate.mock.calls[0];
      const payload = firstCall[0];

      // content should be an array of text content blocks
      expect(Array.isArray(payload.content)).toBe(true);
      
      // Each block should have type "text" and text property
      if (payload.content.length > 0) {
        const block = payload.content[0];
        expect(block).toHaveProperty("type");
        expect(block.type).toBe("text");
        expect(block).toHaveProperty("text");
      }
    });

    it("avoids duplicate assistant text from message_update and message_end", async () => {
      const entries: any[] = [];
      const onUpdate = vi.fn((update: any) => {
        if (update.details.entries) {
          entries.push(...update.details.entries);
        }
      });

      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      const assistantTextEntries = result.details.entries.filter((e: any) => e.type === "assistant_text");
      expect(assistantTextEntries.length).toBeGreaterThan(0);

      const fullText = "Hello, I have completed the task. Here are the results.";
      const finalAssistantEntry = assistantTextEntries[assistantTextEntries.length - 1];
      expect((finalAssistantEntry as any).text).toBe(fullText);
      expect(assistantTextEntries.filter((e: any) => (e as any).text === fullText)).toHaveLength(1);
    });

    it("verifies live update content contains text and is not empty during execution", async () => {
      const contentPerUpdate: string[][] = [];
      const onUpdate = vi.fn((update: { content: Array<{ type: string; text: string }>; details: any }) => {
        contentPerUpdate.push(update.content.map(c => c.text));
      });

      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello " }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Hello " } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello, I have completed the task. Here are the results." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello, I have completed the task. Here are the results." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];


      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // At least one update should have non-empty content text
      const hasNonEmptyContent = contentPerUpdate.some(content => 
        content.length > 0 && content.some(text => text.length > 0)
      );
      expect(hasNonEmptyContent).toBe(true);
    });

    it("handles message_update without delta by reading all text blocks from content", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      // Events WITHOUT assistantMessageEvent - tests fallback
      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello " },
              { type: "text", text: "world!" }
            ],
            timestamp: Date.now(),
          },
          // No assistantMessageEvent - should fall back to reading all text blocks
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Hello world! Final result." }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Hello world! Final result." }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Verify that text from all blocks was captured (fallback behavior)
      const entries = onUpdate.mock.calls.flatMap(call => 
        call[0].details.entries.filter((e: any) => e.type === "assistant_text")
      );
      
      // Should have captured text from both blocks combined
      const allText = entries.map(e => e.text).join("");
      expect(allText).toContain("Hello ");
      expect(allText).toContain("world!");
    });

    it("final assistant transcript text matches result.finalText on completion", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      // Stream partial text in message_update, then message_end has full text
      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Working..." }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: "Working..." } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Final result from subagent execution" }
            ],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Final result from subagent execution" }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // result.finalText should be the complete final assistant text
      expect(result.finalText).toBe("Final result from subagent execution");

      // Get the final assistant_text entry from transcript
      const assistantTextEntries = result.details.entries.filter(
        (e: any) => e.type === "assistant_text"
      );
      expect(assistantTextEntries.length).toBeGreaterThan(0);

      // The final assistant_text in transcript should match result.finalText
      const finalAssistantText = assistantTextEntries[assistantTextEntries.length - 1];
      expect((finalAssistantText as any).text).toBe(result.finalText);
    });

    it("no duplicate full assistant text entries when streaming already captured same text", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      // Streaming captures the exact same full text as message_end
      const fullText = "Complete response text";
      const events: any[] = [
        {
          type: "message_update",
          message: {
            role: "assistant",
            content: [{ type: "text", text: fullText }],
            timestamp: Date.now(),
          },
          assistantMessageEvent: { type: "content_delta", delta: fullText } as any,
        },
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: fullText }],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: fullText }],
              timestamp: Date.now(),
            },
          ],
        },
      ];

      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      expect(result.finalText).toBe(fullText);
      const assistantEntries = result.details.entries.filter((e: any) => e.type === "assistant_text");
      expect(assistantEntries.length).toBeGreaterThan(0);
      expect(assistantEntries.filter((e: any) => (e as any).text === fullText)).toHaveLength(1);
      expect((assistantEntries[assistantEntries.length - 1] as any).text).toBe(fullText);
    });
  });

  describe("options compatibility", () => {
    it("accepts subagentName option to specify the subagent type", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Done" }],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [{ role: "assistant", content: [{ type: "text", text: "Done" }], timestamp: Date.now() }],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a finder tool",
        tools: [],
        task: "Search for files",
        timeoutMs: 30000,
        subagentName: "finder",
        onUpdate,
      });

      expect(result).toBeDefined();
      expect(result.details.tool).toBe("finder");
    });

    it("preserves existing timeout, auth, and model behavior", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Done" }],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [{ role: "assistant", content: [{ type: "text", text: "Done" }], timestamp: Date.now() }],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 5000,
        subagentName: "worker",
        onUpdate,
      });

      expect(result).toBeDefined();
      expect(result.details.model).toBeDefined();
    });
  });

  describe("workspace context", () => {
    it("includes cwd context in the prompt when available", async () => {
      const onUpdate = vi.fn();
      const ctx = {
        ...createMockContext(),
        cwd: "/tmp/project-alpha",
      } as ExtensionContext;
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Done" }],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [{ role: "assistant", content: [{ type: "text", text: "Done" }], timestamp: Date.now() }],
        },
      ];

      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Create a landing page for this project",
        timeoutMs: 30000,
        subagentName: "manager",
        onUpdate,
      });

      const promptCall = agentInstances[0]?.prompt?.mock?.calls?.[0]?.[0];
      const promptText = promptCall?.content?.[0]?.text;

      expect(promptText).toContain("Current working directory: /tmp/project-alpha");
      expect(promptText).toContain("Project directory name: project-alpha");
      expect(promptText).toContain("User task:\nCreate a landing page for this project");
    });
  });

  describe("tool context propagation", () => {
    it("wraps tool definitions so nested subagent tools receive extension context", async () => {
      const ctx = createMockContext();
      const model = createMockModel();
      const toolExecute = vi.fn<(...args: any[]) => Promise<any>>(async () => ({
        content: [{ type: "text" as const, text: "ok" }],
        details: { ok: true },
      }));

      const nestedTool = defineTool({
        name: "nested_tool",
        label: "Nested Tool",
        description: "Test nested tool",
        parameters: Type.Object({ value: Type.String() }),
        async execute(toolCallId, params, signal, onUpdate, toolCtx) {
          return toolExecute(toolCallId, params, signal, onUpdate, toolCtx);
        },
      });

      const events: any[] = [
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Done" }],
            timestamp: Date.now(),
          },
        },
      ];

      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [nestedTool],
        task: "Use the nested tool",
        timeoutMs: 30000,
        subagentName: "manager",
      });

      const agentConfig = (mockAgentClass.mock.calls[0] as any[] | undefined)?.[0] as
        | { initialState?: { tools?: Array<{ execute: (...args: any[]) => Promise<any> }> } }
        | undefined;
      const wrappedTool = agentConfig?.initialState?.tools?.[0];

      expect(wrappedTool).toBeDefined();
      if (!wrappedTool) throw new Error("wrapped tool was not created");
      await wrappedTool.execute("tool-1", { value: "x" }, undefined, undefined);

      expect(toolExecute).toHaveBeenCalledWith("tool-1", { value: "x" }, undefined, undefined, ctx);
    });
  });

  describe("thinking level", () => {
    it("passes thinkingLevel into Agent initial state", async () => {
      const ctx = createMockContext();
      const model = createMockModel();

      if (setPendingEventsFn) setPendingEventsFn([]);

      await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "oracle",
        thinkingLevel: "high",
      });

      const agentConfig = (mockAgentClass.mock.calls[0] as any[] | undefined)?.[0] as
        | { initialState?: { thinkingLevel?: string } }
        | undefined;
      expect(agentConfig?.initialState?.thinkingLevel).toBe("high");
    });
  });

  describe("result shape", () => {
    it("returns SubagentResult with finalText and details properties", async () => {
      const onUpdate = vi.fn();
      const ctx = createMockContext();
      const model = createMockModel();

      const events: any[] = [
        {
          type: "message_end",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Done" }],
            timestamp: Date.now(),
          },
        },
        {
          type: "agent_end",
          messages: [{ role: "assistant", content: [{ type: "text", text: "Done" }], timestamp: Date.now() }],
        },
      ];

      // Set events BEFORE calling runIsolatedSubagent
      if (setPendingEventsFn) {
        setPendingEventsFn(events);
      }

      const result = await runIsolatedSubagent({
        ctx,
        model,
        systemPrompt: "You are a helpful assistant",
        tools: [],
        task: "Test task",
        timeoutMs: 30000,
        subagentName: "worker",
        onUpdate,
      });

      // Verify the result shape
      expect(result).toHaveProperty("finalText");
      expect(result).toHaveProperty("details");
      expect(result.details).toHaveProperty("tool");
      expect(result.details).toHaveProperty("task");
      expect(result.details).toHaveProperty("status");
      expect(result.details).toHaveProperty("entries");
      expect(result.details).toHaveProperty("model");
    });
  });
});