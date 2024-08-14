import SafeApiKit, { SafeInfoResponse } from "@safe-global/api-kit";
import { Safe4337Pack } from "@safe-global/relay-kit";
import EthSafeOperation from "@safe-global/relay-kit/dist/src/packs/safe-4337/SafeOperation";
import { calculateSafeUserOperationHash } from "@safe-global/relay-kit/dist/src/packs/safe-4337/utils";
import { ethers } from "ethers";
import { getDeployment } from "./safe";
import { getSafeModuleSetupDeployment } from "@safe-global/safe-modules-deployments";

const isRelevantSafe = (safe: SafeInfoResponse, moduleAddress: string) =>
  safe.threshold === 1 && safe.fallbackHandler === moduleAddress;

export async function existingSafe(
  signer: string,
  chainId: bigint,
  moduleAddress: string
): Promise<string | undefined> {
  const apiKit = new SafeApiKit({
    chainId,
  });
  const safes = (await apiKit.getSafesByOwner(signer)).safes;
  const safeInfos = await Promise.all(
    safes.map((safeAddress) => apiKit.getSafeInfo(safeAddress))
  );
  const relevantSafes = safeInfos.filter((info) =>
    isRelevantSafe(info, moduleAddress)
  );
  console.log("Relevant Safes", relevantSafes);
  if (relevantSafes.length > 0) {
    if (relevantSafes.length > 1) {
      console.warn(
        `Found multiple relevant Safes for ${signer} - using the first`
      );
    }
    return relevantSafes[0].address;
  }
}

export async function loadSafeKit(
  rpcUrl: string,
  bundlerUrl: string,
  nearSigner: string
): Promise<Safe4337Pack> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const [safeModuleAddress, network] = await Promise.all([
    getSafeModuleAddress(provider),
    provider.getNetwork(),
  ]);
  const safeAddress = await existingSafe(
    nearSigner,
    network.chainId,
    safeModuleAddress
  );
  let options = safeAddress
    ? { safeAddress }
    : {
        owners: [nearSigner],
        threshold: 1,
      };
  const safe4337Pack = await Safe4337Pack.init({
    provider: rpcUrl,
    bundlerUrl,
    // Error: Incompatibility detected: Safe modules version 0.3.0 is not supported.
    // The SDK can use 0.2.0 only.
    // safeModulesVersion: "0.3.0",
    options,
  });
  return safe4337Pack;
}

async function getSafeModuleAddress(
  provider: ethers.JsonRpcProvider
): Promise<string> {
  return (
    await getDeployment(getSafeModuleSetupDeployment, {
      provider,
      version: "0.2.0",
    })
  ).getAddress();
}

// This should be part of the kit!
export async function getSafeOpHash(
  provider: ethers.JsonRpcProvider,
  safeKit: Safe4337Pack,
  safeOp: EthSafeOperation
) {
  return calculateSafeUserOperationHash(
    safeOp.data,
    BigInt(await safeKit.getChainId()),
    // The safe isn't deployed so we have to fetch the fallback Handler on our own:
    // await safeKit.protocolKit.getFallbackHandler()
    await getSafeModuleAddress(provider)
  );
}
