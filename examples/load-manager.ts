import dotenv from "dotenv";
import { TransactionManager } from "../src";
import { setupAdapter } from "near-ca";

dotenv.config();

async function main(): Promise<void> {
  const nearAdapter = await setupAdapter({
    accountId: "farmface.testnet",
    mpcContractId: "v1.signer-prod.testnet",
  });

  const managers = new Map<number, TransactionManager>();

  for (const chainId of [1, 10, 100, 137, 11155111]) {
    managers.set(
      chainId,
      await TransactionManager.fromChainId({
        nearAdapter,
        chainId,
        pimlicoKey: process.env.PIMLICO_KEY!,
      })
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
