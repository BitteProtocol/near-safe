import dotenv from "dotenv";
import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ContractSuite } from "./safe";
import { getNearSignature } from "./near";
import { Erc4337Bundler } from "./bundler";
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
  const bundler = new Erc4337Bundler(
    ERC4337_BUNDLER_URL!,
    await safePack.entryPoint.getAddress(),
  );
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
  const paymasterData = await bundler.getPaymasterData(
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

  const userOpHash = await bundler.sendUserOperation({
    ...unsignedUserOp,
    signature,
  });
  console.log("UserOp Hash", userOpHash);

  const userOpReceipt = await bundler.getUserOpReceipt(userOpHash);
  console.log("userOp Receipt", userOpReceipt);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
