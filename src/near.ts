import { ethers } from "ethers";
import { NearEthAdapter } from "near-ca";

export async function getNearSignature(
  adapter: NearEthAdapter,
  hash: ethers.BytesLike,
): Promise<string> {
  const viemHash = typeof hash === "string" ? (hash as `0x${string}`) : hash;
  // MPC Contract produces two possible signatures.
  const signatures = await adapter.sign(viemHash);
  for (const sig of signatures) {
    if (
      ethers.recoverAddress(hash, sig).toLocaleLowerCase() ===
      adapter.address.toLocaleLowerCase()
    ) {
      return ethers.solidityPacked(["uint48", "uint48", "bytes"], [0, 0, sig]);
    }
  }
  throw new Error("Invalid signature!");
}
