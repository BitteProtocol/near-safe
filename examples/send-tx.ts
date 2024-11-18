import dotenv from "dotenv";
import { formatEther, isAddress } from "viem";

import { loadArgs, loadEnv } from "./cli";
import {
  DEFAULT_SAFE_SALT_NONCE,
  NearSafe,
  Network,
  userOpTransactionCost,
} from "../src";

dotenv.config();

async function main(): Promise<void> {
  const [
    { pimlicoKey, nearAccountId, nearAccountPrivateKey },
    { mpcContractId, recoveryAddress, sponsorshipPolicy },
  ] = await Promise.all([loadEnv(), loadArgs()]);
  const chainId = 11155111;
  const txManager = await NearSafe.create({
    mpc: {
      accountId: nearAccountId,
      mpcContractId,
      privateKey: nearAccountPrivateKey,
    },
    pimlicoKey,
    safeSaltNonce: DEFAULT_SAFE_SALT_NONCE,
  });
  const deployed = await txManager.safeDeployed(chainId);
  console.log(`Safe Deployed (on chainId ${chainId}): ${deployed}`);
  const transactions = [
    // TODO: Replace dummy transaction with real user transaction.
    {
      to: "0xbeef4dad00000000000000000000000000000000",
      value: "0", // 0 value transfer with non-trivial data.
      data: "0xbeef",
    },
  ];
  // Add Recovery if safe not deployed & recoveryAddress was provided.
  if (recoveryAddress && isAddress(recoveryAddress)) {
    const recoveryTx = txManager.addOwnerTx(recoveryAddress);
    // This would happen (sequentially) after the userTx, but all executed in a single
    transactions.push(recoveryTx);
  }

  const unsignedUserOp = await txManager.buildTransaction({
    chainId,
    transactions,
    sponsorshipPolicy,
  });
  console.log("Unsigned UserOp", unsignedUserOp);
  const safeOpHash = await txManager.opHash(chainId, unsignedUserOp);
  console.log("Safe Op Hash", safeOpHash);

  const gasCost = userOpTransactionCost(unsignedUserOp);
  console.log("Estimated gas cost", formatEther(gasCost));
  // Whenever not using paymaster, or on value transfer, the Safe must be funded.
  const sufficientFunded = await txManager.sufficientlyFunded(
    chainId,
    transactions,
    !!sponsorshipPolicy ? 0n : gasCost
  );
  if (!sufficientFunded) {
    console.warn(
      `Safe ${txManager.address} insufficiently funded to perform this transaction. Exiting...`
    );
    process.exit(0); // soft exit with warning!
  }

  console.log("Signing with Near at", txManager.mpcContractId);
  const signature = await txManager.signTransaction(safeOpHash);

  console.log("Executing UserOp...");
  const userOpHash = await txManager.executeTransaction(chainId, {
    ...unsignedUserOp,
    signature,
  });
  console.log("userOpHash:", userOpHash);

  const { receipt } = await txManager.getOpReceipt(chainId, userOpHash);
  console.log(
    `View Transaction: ${Network.fromChainId(chainId).scanUrl}/tx/${receipt.transactionHash}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
