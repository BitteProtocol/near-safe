import dotenv from "dotenv";
import { ethers } from "ethers";
import { loadArgs, loadEnv } from "./cli";
import { TransactionManager } from "../src";
import { setupAdapter } from "near-ca";

dotenv.config();

async function main(): Promise<void> {
  const [
    { pimlicoKey, nearAccountId, nearAccountPrivateKey },
    { mpcContractId, recoveryAddress, usePaymaster },
  ] = await Promise.all([loadEnv(), loadArgs()]);
  const chainId = 11155111;
  const txManager = await TransactionManager.create({
    ethRpc: "https://rpc2.sepolia.org",
    nearAdapter: await setupAdapter({
      accountId: nearAccountId,
      // This must be set to transact. Otherwise, instance will be read-only
      privateKey: nearAccountPrivateKey,
      mpcContractId,
    }),
    pimlicoKey,
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
  if (!(await txManager.safeDeployed(chainId)) && recoveryAddress) {
    const recoveryTx = txManager.addOwnerTx(recoveryAddress);
    // This would happen (sequentially) after the userTx, but all executed in a single
    transactions.push(recoveryTx);
  }

  const unsignedUserOp = await txManager.buildTransaction({
    chainId,
    transactions,
    usePaymaster,
  });
  console.log("Unsigned UserOp", unsignedUserOp);
  const safeOpHash = await txManager.opHash(unsignedUserOp);
  console.log("Safe Op Hash", safeOpHash);

  // TODO: Evaluate gas cost (in ETH)
  const gasCost = ethers.parseEther("0.01");
  // Whenever not using paymaster, or on value transfer, the Safe must be funded.
  const sufficientFunded = await txManager.safeSufficientlyFunded(
    chainId,
    transactions,
    usePaymaster ? 0n : gasCost
  );
  if (!sufficientFunded) {
    console.warn(
      `Safe ${txManager.address} insufficiently funded to perform this transaction. Exiting...`
    );
    process.exit(0); // soft exit with warning!
  }

  console.log("Signing with Near...");
  const signature = await txManager.signTransaction(safeOpHash);

  console.log("Executing UserOp...");
  const userOpReceipt = await txManager.executeTransaction(chainId, {
    ...unsignedUserOp,
    signature,
  });
  console.log("userOp Receipt", userOpReceipt);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
