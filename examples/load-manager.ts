import dotenv from "dotenv";
import { managerForChainId, TransactionManager } from "../src";
import { MpcContract, nearAccountFromAccountId, NearEthAdapter } from "near-ca";

dotenv.config();

async function main(): Promise<void> {
  const nearNetwork = {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
  };
  const nearAccount = await nearAccountFromAccountId(
    process.env.NEAR_ACCOUNT_ID!,
    nearNetwork
  );
  const nearAdapter = await NearEthAdapter.fromConfig({
    mpcContract: new MpcContract(nearAccount, "v1.signer-prod.testnet"),
  });
  const managers = new Map<number, TransactionManager>();
  console.log("Start");
  for (const chainId of [100, 137, 11155111]) {
    managers.set(
      chainId,
      await managerForChainId(nearAdapter, chainId, process.env.PIMLICO_KEY!)
    );
  }

  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
