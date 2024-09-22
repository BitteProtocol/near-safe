import fs from "fs";
import path from "path";

import {
  fetchDeployments,
  MODULE_VERSION,
  SAFE_VERSION,
} from "./fetch-deployments";

// Main function to fetch and write deployment data
export async function fetchAndWriteDeployments(
  outPath: string = "src/_gen",
  safeVersion: string = SAFE_VERSION,
  moduleVersion: string = MODULE_VERSION
): Promise<void> {
  const { singleton, proxyFactory, moduleSetup, m4337, entryPoint } =
    await fetchDeployments(safeVersion, moduleVersion);

  try {
    // Specify output file path
    const outputPath = path.join(process.cwd(), outPath, "deployments.ts");
    // const outputPath = path.join(
    //   process.cwd(),
    //   outPath,
    //   `safe_v${safeVersion}_module_v${moduleVersion}.json`
    // );

    // Ensure the directory exists
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    // Write deployment data to file
    // fs.writeFileSync(outputPath, JSON.stringify(deployments, null, 2));
    const tsContent = `
    // Auto-generated file from build script
    import { SafeDeployments } from "../types";

    export const SAFE_DEPLOYMENTS: SafeDeployments = {
      singleton: {
        address: "${singleton.address}",
        abi: ${JSON.stringify(singleton.abi, null, 2)},
      },
      proxyFactory: {
        address: "${proxyFactory.address}",
        abi: ${JSON.stringify(proxyFactory.abi, null, 2)},
      },
      moduleSetup: {
        address: "${moduleSetup.address}",
        abi: ${JSON.stringify(moduleSetup.abi, null, 2)},
      },
      m4337: {
        address: "${m4337.address}",
        abi: ${JSON.stringify(m4337.abi, null, 2)},
      },
      entryPoint: {
        address: "${entryPoint.address}",
        abi: ${JSON.stringify(entryPoint.abi, null, 2)},
      },
    };
    `;
    fs.writeFileSync(outputPath, tsContent, "utf-8");
    console.log(
      `TypeScript constants generated at ${path.join(outPath, "deployments.ts")}`
    );
  } catch (error) {
    console.error("Error fetching deployments:", error);
  }
}

async function main(): Promise<void> {
  await fetchAndWriteDeployments();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
