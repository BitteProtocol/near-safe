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

  const contracts = await ContractSuite.init(provider);
  const setup = await contracts.getSetup(
    RECOVERY_ADDRESS !== undefined
      ? [nearAdapter.address, RECOVERY_ADDRESS]
      : [nearAdapter.address],
  );

  const safeAddress = await contracts.getSafeAddressForSetup(
    setup,
    SAFE_SALT_NONCE,
  );
  console.log("Safe Address:", safeAddress);
  const safeNotDeployed = (await provider.getCode(safeAddress)) === "0x";
  if (safeNotDeployed && !argv.usePaymaster) {
    // Check safe has been funded:
    const safeBalance = await provider.getBalance(safeAddress);
    if (safeBalance === 0n) {
      console.log("WARN: Undeployed Safe is must be funded.");
      return;
    }
  }
  // TODO(bh2smith) Use Bundler Gas Data Feed:
  // Error: maxPriorityFeePerGas must be at least 330687958 (current maxPriorityFeePerGas: 328006616)
  // - use pimlico_getUserOperationGasPrice to get the current gas price
  const gasFees = await provider.getFeeData();
  const { maxPriorityFeePerGas, maxFeePerGas } = gasFees;
  if (!maxPriorityFeePerGas || !maxFeePerGas) {
    throw new Error("no gas fee data");
  }
  console.log("Gas Fees", gasFees);
  const rawUserOp = {
    sender: safeAddress,
    nonce: ethers.toBeHex(await contracts.entryPoint.getNonce(safeAddress, 0)),
    ...(safeNotDeployed
      ? {
          factory: contracts.proxyFactory.target,
          factoryData: contracts.proxyFactory.interface.encodeFunctionData(
            "createProxyWithNonce",
            [contracts.singleton.target, setup, SAFE_SALT_NONCE],
          ),
        }
      : {}),
    // <https://github.com/safe-global/safe-modules/blob/9a18245f546bf2a8ed9bdc2b04aae44f949ec7a0/modules/4337/contracts/Safe4337Module.sol#L172>
    callData: contracts.m4337.interface.encodeFunctionData("executeUserOp", [
      nearAdapter.address,
      1n, // 1 wei
      ethers.hexlify(
        ethers.toUtf8Bytes("https://github.com/bh2smith/nearly-safe"),
      ),
      0,
    ]),
    maxPriorityFeePerGas: ethers.toBeHex(maxPriorityFeePerGas * 2n),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
  };
  const paymasterData = await getPaymasterData(
    ERC4337_BUNDLER_URL!,
    await contracts.entryPoint.getAddress(),
    rawUserOp,
    argv.usePaymaster,
    safeNotDeployed,
  );
  const unsignedUserOp = {
    ...rawUserOp,
    ...paymasterData,
  };
  console.log("Unsigned UserOp", unsignedUserOp);
  const safeOpHash = await contracts.getOpHash(unsignedUserOp, paymasterData);

  console.log("Signing with Near...");
  const signature = await getNearSignature(nearAdapter, safeOpHash);

  const userOpHash = await sendUserOperation(
    ERC4337_BUNDLER_URL!,
    { ...unsignedUserOp, signature },
    await contracts.entryPoint.getAddress(),
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
