import { ethers } from "ethers";
import { NearEthAdapter } from "near-ca";

export async function getNearSignature(
  adapter: NearEthAdapter,
  hash: ethers.BytesLike
): Promise<string> {
  const viemHash = typeof hash === "string" ? (hash as `0x${string}`) : hash;
  // MPC Contract produces two possible signatures.
  const signature = await adapter.sign(viemHash);
  if (
    ethers.recoverAddress(hash, signature).toLocaleLowerCase() ===
    adapter.address.toLocaleLowerCase()
  ) {
    return signature;
  }
  throw new Error("Invalid signature!");
}
