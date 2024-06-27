import dotenv from "dotenv";
import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ContractSuite } from "./safe";
import { getNearSignature } from "./near";
import {
  getPaymasterData,
  getUserOpReceipt,
  sendUserOperation,
} from "./bundler";
import { assertFunded } from "./util";

dotenv.config();
const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL, ETH_RPC, RECOVERY_ADDRESS } =
  process.env;

async function main() {
  const argv = await yargs(hideBin(process.argv)).option("usePaymaster", {
    type: "boolean",
    description: "Have transaction sponsored by paymaster service",
    default: false,
  }).argv;
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const nearAdapter = await NearEthAdapter.fromConfig({
    mpcContract: await MultichainContract.fromEnv(),
  });
  console.log(
    `NearEth Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`,
  );

  const safePack = await ContractSuite.init(provider);
  const owners =
    RECOVERY_ADDRESS !== undefined
      ? [nearAdapter.address, RECOVERY_ADDRESS]
      : [nearAdapter.address];
  const setup = await safePack.getSetup(owners);
  const safeAddress = await safePack.addressForSetup(setup, SAFE_SALT_NONCE);
  console.log("Safe Address:", safeAddress);
  // Check safe has been funded:
  const safeNotDeployed = await assertFunded(
    provider,
    safeAddress,
    argv.usePaymaster,
  );

  // TODO(bh2smith) Use Bundler Gas Data Feed:
  // Error: maxPriorityFeePerGas must be at least 330687958 (current maxPriorityFeePerGas: 328006616)
  // - use pimlico_getUserOperationGasPrice to get the current gas price
  const gasFees = await provider.getFeeData();

  const rawUserOp = await safePack.buildUserOp(
    // Transaction Data:
    { to: nearAdapter.address, value: 1n, data: "0x69" },
    safeAddress,
    gasFees,
    setup,
    safeNotDeployed,
    SAFE_SALT_NONCE || "0",
  );
  const paymasterData = await getPaymasterData(
    ERC4337_BUNDLER_URL!,
    await safePack.entryPoint.getAddress(),
    rawUserOp,
    argv.usePaymaster,
    safeNotDeployed,
  );

  const unsignedUserOp = {
    ...rawUserOp,
    ...paymasterData,
  };
  console.log("Unsigned UserOp", unsignedUserOp);
  const safeOpHash = await safePack.getOpHash(unsignedUserOp, paymasterData);

  console.log("Signing with Near...");
  const signature = await getNearSignature(nearAdapter, safeOpHash);

  const userOpHash = await sendUserOperation(
    ERC4337_BUNDLER_URL!,
    { ...unsignedUserOp, signature },
    await safePack.entryPoint.getAddress(),
  );
  console.log("UserOp Hash", userOpHash);

  // TODO(bh2smith): use safe4337Pack
  // https://docs.safe.global/sdk/relay-kit/guides/4337-safe-sdk#check-the-transaction-status
  let userOpReceipt = null;
  while (!userOpReceipt) {
    // Wait 2 seconds before checking the status again
    await new Promise((resolve) => setTimeout(resolve, 2000));
    userOpReceipt = await getUserOpReceipt(ERC4337_BUNDLER_URL!, userOpHash);
  }
  console.log("userOp Receipt", userOpReceipt);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
