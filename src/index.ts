import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";
import { librarianTool } from "./tools/librarian.js";
import { workerTool } from "./tools/worker.js";
import { managerTool } from "./tools/manager.js";
import { registerNightconfigCommand } from "./tools/nightconfig.js";

export default function nightmanagerExtension(pi: ExtensionAPI) {
  pi.registerTool(finderTool);
  pi.registerTool(oracleTool);
  pi.registerTool(librarianTool);
  pi.registerTool(workerTool);
  pi.registerTool(managerTool);
  registerNightconfigCommand(pi);
}
