import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";
import { Address, parseAbi } from "viem";

import { Deployment, SafeDeployments } from "../src/types";
import { getClient } from "../src/util";

// Define the deployment version and chain ID (e.g., "1.4.1" for Safe contracts, "0.3.0" for modules)
export const SAFE_VERSION = "1.4.1";
export const MODULE_VERSION = "0.3.0";

type DeploymentFn = (filter?: {
  version: string;
}) =>
  | { networkAddresses: { [chainId: string]: string }; abi: unknown[] }
  | undefined;

type DeploymentArgs = { version: string };

export async function getDeployment(
  fn: DeploymentFn,
  { version }: DeploymentArgs
): Promise<Deployment> {
  const deployment = fn({ version });
  if (!deployment) {
    throw new Error(`Deployment not found for ${fn.name} version ${version}`);
  }
  // TODO: maybe call parseAbi on deployment.abi here.
  return {
    address: deployment.networkAddresses["11155111"] as Address,
    abi: deployment.abi,
  };
}

export async function fetchDeployments(
  safeVersion: string = SAFE_VERSION,
  moduleVersion: string = MODULE_VERSION
): Promise<SafeDeployments> {
  console.log("Fetching deployments...");
  const safeDeployment = async (fn: DeploymentFn): Promise<Deployment> =>
    getDeployment(fn, { version: safeVersion });

  const m4337Deployment = async (fn: DeploymentFn): Promise<Deployment> =>
    getDeployment(fn, { version: moduleVersion });

  try {
    // Fetch deployments for Safe and 4337 modules
    const [singleton, proxyFactory, moduleSetup, m4337] = await Promise.all([
      safeDeployment(getSafeL2SingletonDeployment),
      safeDeployment(getProxyFactoryDeployment),
      m4337Deployment(getSafeModuleSetupDeployment),
      m4337Deployment(getSafe4337ModuleDeployment),
    ]);
    // TODO - this is a cheeky hack.
    const client = getClient(11155111);
    const entryPoint = {
      address: (await client.readContract({
        address: m4337.address,
        abi: m4337.abi,
        functionName: "SUPPORTED_ENTRYPOINT",
      })) as Address,
      abi: parseAbi([
        "function getNonce(address, uint192 key) view returns (uint256 nonce)",
      ]),
    };
    return {
      singleton,
      proxyFactory,
      moduleSetup,
      m4337,
      entryPoint,
    };
  } catch (error) {
    throw new Error(`Error fetching deployments: ${error}`);
  }
}
