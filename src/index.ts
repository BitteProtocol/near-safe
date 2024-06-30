import dotenv from "dotenv";
import { TransactionManager } from "./tx-manager";
import { loadArgs } from "./cli";
import { ethers } from "ethers";

dotenv.config();

async function main() {
  const options = await loadArgs();
  const txManager = await TransactionManager.create({
    ethRpc: process.env.ETH_RPC!,
    erc4337BundlerUrl: process.env.ERC4337_BUNDLER_URL!,
    options,
  });
  const { unsignedUserOp, safeOpHash } = await txManager.buildTransaction({
    // TODO: Replace dummy transaction.
    transactions: [
      {
        to: "0x0000000000000000000000000000000000000000",
        value: "1",
        data: "0x",
      },
      {
        to: "0x0000000000000000000000000000000000000000",
        value: "2",
        data: "0x",
      },
    ],
    options,
  });
  console.log("Unsigned UserOp", unsignedUserOp);
  console.log("Safe Op Hash", safeOpHash);

  if (!options.usePaymaster) {
    // Ensure the Safe is funded if it's not using paymaster.
    await txManager.assertFunded();
  }

  console.log("Signing with Near...");
  const signature = await txManager.signTransaction(safeOpHash);

  console.log("Executing UserOp...");
  const userOpReceipt = await txManager.executeTransaction({
    ...unsignedUserOp,
    signature,
  });
  console.log("userOp Receipt", userOpReceipt);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
