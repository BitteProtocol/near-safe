import dotenv from "dotenv";
import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import {
  PimlicoFeeEstimator,
  UserOperationReceipt,
} from "@safe-global/relay-kit";
import { getSafeAddressForSetup, safePackFromEnv } from "./safe";
import { sendUserOperation } from "./erc4337";
import { getNearSignature } from "./near";

dotenv.config();
const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL, ETH_RPC } = process.env;

async function main() {
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const nearAdapter = await NearEthAdapter.fromConfig({
    mpcContract: await MultichainContract.fromEnv(),
  });
  console.log(
    `NearEth Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`,
  );

  let {
    safe4337Pack,
    contracts,
    setupData: setup,
  } = await safePackFromEnv(provider, nearAdapter.address);

  const safeAddress = await getSafeAddressForSetup(
    contracts,
    setup,
    SAFE_SALT_NONCE,
  );
  console.log("Safe Address:", safeAddress);
  const preUserOp = await safe4337Pack.createTransaction({
    transactions: [
      {
        to: nearAdapter.address,
        value: "1", // 1 wei
        data: ethers.hexlify(
          ethers.toUtf8Bytes("https://github.com/bh2smith/nearly-safe"),
        ),
      },
    ],
  });
  const estimator = new PimlicoFeeEstimator();
  // test doesn't align with interface declaration:
  // test: https://github.com/safe-global/safe-core-sdk/blob/8896940929eb23b154e0e6615226f1f7c004c7fb/packages/relay-kit/src/packs/safe-4337/estimators/PimlicoFeeEstimator.test.ts#L29-L33
  // interface (only uses bundlerUrl): https://github.com/safe-global/safe-core-sdk/blob/8896940929eb23b154e0e6615226f1f7c004c7fb/packages/relay-kit/src/packs/safe-4337/estimators/PimlicoFeeEstimator.ts#L13
  const sponsoredGasEstimation = await estimator.setupEstimation({
    bundlerUrl: ERC4337_BUNDLER_URL!,
    userOperation: preUserOp.toUserOperation(),
    entryPoint: await contracts.entryPoint.getAddress(),
  });

  // This didn't modify the object! Or at least IDE can't tell.
  // unsignedUserOp.addEstimations(sponsoredGasEstimation);
  // Fee estimation only contains: { maxFeePerGas: '0x208ff4', maxPriorityFeePerGas: '0x150ea0' }
  const safeDeployed = (await provider.getCode(safeAddress)) !== "0x";
  const userOp = {
    ...preUserOp.toUserOperation(),
    ...sponsoredGasEstimation,
    verificationGasLimit: safeDeployed ? 100000n : 500000n,
    callGasLimit: 100000n,
    preVerificationGas: 100000n,
  };
  userOp.initCode = safeDeployed ? "0x" : userOp.initCode;

  console.log("Fee Estimation", sponsoredGasEstimation);

  const packGas = (hi: ethers.BigNumberish, lo: ethers.BigNumberish) =>
    ethers.solidityPacked(["uint128", "uint128"], [hi, lo]);
  const safeOpHash = await contracts.m4337.getOperationHash({
    ...userOp,
    accountGasLimits: packGas(userOp.verificationGasLimit, userOp.callGasLimit),
    gasFees: packGas(userOp.maxPriorityFeePerGas, userOp.maxFeePerGas),
    paymasterAndData: "0x",
    signature: ethers.solidityPacked(["uint48", "uint48"], [0, 0]),
  });
  console.log("Safe Op Hash", safeOpHash);
  console.log("Signing with Near...");
  const signature = ethers.solidityPacked(
    ["uint48", "uint48", "bytes"],
    [0, 0, await getNearSignature(nearAdapter, safeOpHash)],
  );

  // Not sure if we can use the sdk here because we didn't "sign" the Safe Operation, but rather the UserOperation.
  const userOpHash = await sendUserOperation(
    ERC4337_BUNDLER_URL!,
    { ...userOp, signature },
    await contracts.entryPoint.getAddress(),
  );
  console.log("UserOp Hash", userOpHash);
  let userOpReceipt: UserOperationReceipt | null = null;
  while (!userOpReceipt) {
    // Wait 2 seconds before checking the status again
    await new Promise((resolve) => setTimeout(resolve, 2000));
    userOpReceipt = await safe4337Pack.getUserOperationReceipt(userOpHash);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
