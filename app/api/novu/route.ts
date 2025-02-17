import { serve } from "@novu/framework/next";
import { testWorkflow } from "../workflows/test/test";

export const { GET, POST, OPTIONS } = serve({ workflows: [testWorkflow] });