import path from "node:path";
import { pathToFileURL } from "node:url";
import { finalizePresentation } from "/Users/falahalshidi/.codex/plugins/cache/openai-primary-runtime/presentations/26.1119.11507/skills/presentations/container_tools/artifact_tool_utils.mjs";

const workspaceDir = "/Users/falahalshidi/Downloads/dev/project-sofware";
const skillDir = "/Users/falahalshidi/.codex/plugins/cache/openai-primary-runtime/presentations/26.1119.11507/skills/presentations";
const candidatePath = path.join(workspaceDir, ".pptx-build", "skycast-weather-draft-v4.pptx");
const finalPath = path.join(workspaceDir, "presentation-output", "SkyCast-Weather-Presentation-v2.pptx");
const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "/Users/falahalshidi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: { basis: "design", families: ["Aptos"] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".pptx-build", "SkyCast-Weather-Presentation-v4.validation.json"),
});
console.log(JSON.stringify(result));
