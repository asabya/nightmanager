import { finderTool } from "./tools/finder.js";
import { oracleTool } from "./tools/oracle.js";
import { workerTool } from "./tools/worker.js";
import { managerTool } from "./tools/manager.js";
import { registerNightconfigCommand } from "./tools/nightconfig.js";
export default function nightmanagerExtension(pi) {
    pi.registerTool(finderTool);
    pi.registerTool(oracleTool);
    pi.registerTool(workerTool);
    pi.registerTool(managerTool);
    registerNightconfigCommand(pi);
}
//# sourceMappingURL=index.js.map