import dotenv from "dotenv";
import { ethers } from "ethers";
import { loadArgs } from "./cli";
import { TransactionManager } from "../src";

dotenv.config();

async function main(): Promise<void> {
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
      value: "0", // 0 value transfer with non-trivial data.
      data: "0xbeef",
    },
  ];
  // Add Recovery if safe not deployed & recoveryAddress was provided.
  if (txManager.safeNotDeployed && options.recoveryAddress) {
    const recoveryTx = txManager.addOwnerTx(options.recoveryAddress);
    // This would happen (sequentially) after the userTx, but all executed in a single
    transactions.push(recoveryTx);
  }

  const { unsignedUserOp, safeOpHash } = await txManager.buildTransaction({
    transactions,
    options,
  });
  console.log("Unsigned UserOp", unsignedUserOp);
  console.log("Safe Op Hash", safeOpHash);

  // TODO: Evaluate gas cost (in ETH)
  const gasCost = ethers.parseEther("0.01");
  // Whenever not using paymaster, or on value transfer, the Safe must be funded.
  const sufficientFunded = await txManager.safeSufficientlyFunded(
    transactions,
    options.usePaymaster ? 0n : gasCost
  );
  if (!sufficientFunded) {
    console.warn(
      `Safe ${txManager.safeAddress} insufficiently funded to perform this transaction. Exiting...`
    );
    process.exit(0); // soft exit with warning!
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
