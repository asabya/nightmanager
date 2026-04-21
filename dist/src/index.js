import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";
import { workerTool } from "./tools/worker.js";
import { managerTool } from "./tools/manager.js";
export default function subagentsExtension(pi) {
    pi.registerTool(finderTool);
    pi.registerTool(oracleTool);
    pi.registerTool(workerTool);
    pi.registerTool(managerTool);
}
//# sourceMappingURL=index.js.map