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
    safeSaltNonce: options.safeSaltNonce,
  });
  const transactions = [
    // TODO: Replace dummy transaction with real user transaction.
    {
      to: "0xbeef4dad00000000000000000000000000000000",
      value: "1", // 1 wei
      data: "0xbeef",
    },
  ];
  // Add Recovery if safe not deployed & recoveryAddress was provided.
  if (txManager.safeNotDeployed && options.recoveryAddress) {
    const recoveryTx = txManager.addOwnerTx(options.recoveryAddress);
    transactions.push(recoveryTx);
  }
  const { unsignedUserOp, safeOpHash } = await txManager.buildTransaction({
    transactions,
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
