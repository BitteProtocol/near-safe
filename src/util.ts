import { ethers } from "ethers";

export const packGas = (hi: ethers.BigNumberish, lo: ethers.BigNumberish) =>
  ethers.solidityPacked(["uint128", "uint128"], [hi, lo]);

export async function assertFunded(
  provider: ethers.JsonRpcProvider,
  safeAddress: ethers.AddressLike,
  usePaymaster: boolean,
): Promise<boolean> {
  const safeNotDeployed = (await provider.getCode(safeAddress)) === "0x";
  if (safeNotDeployed && !usePaymaster) {
    // Check safe has been funded:
    const safeBalance = await provider.getBalance(safeAddress);
    if (safeBalance === 0n) {
      console.log("WARN: Undeployed Safe is must be funded.");
      process.exitCode = 1;
    }
  }
  return safeNotDeployed;
}

export function packSignature(
  signature: string,
  validFrom: number = 0,
  validTo: number = 0,
): string {
  return ethers.solidityPacked(
    ["uint48", "uint48", "bytes"],
    [validFrom, validTo, signature],
  );
}
