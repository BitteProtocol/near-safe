import dotenv from "dotenv";
import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ContractSuite } from "./safe";
import { getNearSignature } from "./near";
import {
  getUserOpReceipt,
  packPaymasterData,
  sendUserOperation,
} from "./bundler";

dotenv.config();
const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL, ETH_RPC, RECOVERY_ADDRESS } =
  process.env;
const DUMMY_ECDSA_SIG =
  "0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

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
  const { maxPriorityFeePerGas, maxFeePerGas } = await provider.getFeeData();
  if (!maxPriorityFeePerGas || !maxFeePerGas) {
    throw new Error("no gas fee data");
  }
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
    maxPriorityFeePerGas: ethers.toBeHex((maxPriorityFeePerGas * 15n) / 10n),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
  };
  let paymasterData = {
    verificationGasLimit: ethers.toBeHex(safeNotDeployed ? 500000 : 100000),
    callGasLimit: ethers.toBeHex(100000),
    preVerificationGas: ethers.toBeHex(100000),
  };
  if (argv.usePaymaster) {
    console.log("Requesting paymaster data");
    const pimlicoProvider = new ethers.JsonRpcProvider(ERC4337_BUNDLER_URL);
    paymasterData = await pimlicoProvider.send("pm_sponsorUserOperation", [
      { ...rawUserOp, signature: DUMMY_ECDSA_SIG },
      await contracts.entryPoint.getAddress(),
    ]);
    console.log("PaymasterData", paymasterData);
  }
  const unsignedUserOp = {
    ...rawUserOp,
    ...paymasterData,
  };
  console.log("Unsigned UserOp", unsignedUserOp);

  const packGas = (hi: ethers.BigNumberish, lo: ethers.BigNumberish) =>
    ethers.solidityPacked(["uint128", "uint128"], [hi, lo]);
  const safeOpHash = await contracts.m4337.getOperationHash({
    ...unsignedUserOp,
    initCode: unsignedUserOp.factory
      ? ethers.solidityPacked(
          ["address", "bytes"],
          [unsignedUserOp.factory, unsignedUserOp.factoryData],
        )
      : "0x",
    accountGasLimits: packGas(
      unsignedUserOp.verificationGasLimit,
      unsignedUserOp.callGasLimit,
    ),
    gasFees: packGas(
      unsignedUserOp.maxPriorityFeePerGas,
      unsignedUserOp.maxFeePerGas,
    ),
    paymasterAndData: packPaymasterData(paymasterData),
    signature: ethers.solidityPacked(["uint48", "uint48"], [0, 0]),
  });
  console.log("Safe Op Hash", safeOpHash);
  console.log("Signing with Near...");
  const signature = ethers.solidityPacked(
    ["uint48", "uint48", "bytes"],
    [0, 0, await getNearSignature(nearAdapter, safeOpHash)],
  );
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
