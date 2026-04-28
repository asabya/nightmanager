import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";
import { workerTool } from "./tools/worker.js";
import { managerTool } from "./tools/manager.js";

export default function nightmanagerExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
  pi.registerTool(workerTool);
  pi.registerTool(managerTool);
}
