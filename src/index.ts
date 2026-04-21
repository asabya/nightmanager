import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";

export default function subagentsExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
}
