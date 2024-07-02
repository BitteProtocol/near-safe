import { ethers } from "ethers";
import { NearEthAdapter } from "near-ca";
import { Hash, Hex } from "viem";

export async function getNearSignature(
  adapter: NearEthAdapter,
  hash: Hash
): Promise<Hex> {
  // MPC Contract produces two possible signatures.
  const signatures = await adapter.sign(hash);
  for (const sig of signatures) {
    if (
      ethers.recoverAddress(hash, sig).toLocaleLowerCase() ===
      adapter.address.toLocaleLowerCase()
    ) {
      return sig;
    }
  }
  throw new Error("Invalid signature!");
}
