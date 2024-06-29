import dotenv from "dotenv";
import { TransactionManager } from "./tx-manager";
import { loadArgs } from "./cli";

dotenv.config();

async function main() {
  const options = await loadArgs();
  const txManager = await TransactionManager.fromEnv();
  const { unsignedUserOp, safeOpHash } = await txManager.buildTransaction({
    // TODO: Replace dummy transaction.
    transaction: { to: txManager.nearEOA, value: 1n, data: "0x69" },
    options,
  });
  console.log("Unsigned UserOp", unsignedUserOp);
  console.log("Safe Op Hash", safeOpHash);
  
  // Ensure the Safe is funded if it's not using paymaster.
  await txManager.assertFunded(options.usePaymaster);
  
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
