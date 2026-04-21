import type { DelegateTool, TaskShape } from "../types/shared.js";
export declare function classifyTaskShape(input: string): TaskShape;
export declare function chooseDelegate(shape: Exclude<TaskShape, "ambiguous">): DelegateTool;
