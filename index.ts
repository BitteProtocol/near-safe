// TODO(nlordell): Should probably be configured correctly with tsconfig.json
/// <reference lib="dom" />

import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";
import dotenv from "dotenv";
import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";

dotenv.config();
const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL } = process.env;

type DeploymentFunction = (filter?: {
  version: string;
}) =>
  | { networkAddresses: { [chainId: string]: string }; abi: unknown[] }
  | undefined;
type DeploymentArgs = { provider: ethers.JsonRpcProvider; version: string };

async function getDeployment(
  fn: DeploymentFunction,
  { provider, version }: DeploymentArgs,
) {
  const { chainId } = await provider.getNetwork();
  const deployment = fn({ version });
  if (!deployment || !deployment.networkAddresses[`${chainId}`]) {
    throw new Error(
      `Deployment not found for version ${version} and chainId ${chainId}`,
    );
  }
  return new ethers.Contract(
    deployment.networkAddresses[`${chainId}`],
    deployment.abi as ethers.Fragment[],
    provider,
  );
}

async function getNearSignature(
  adapter: NearEthAdapter,
  hash: ethers.BytesLike,
): Promise<`0x${string}`> {
  const viemHash = typeof hash === "string" ? (hash as `0x${string}`) : hash;
  // MPC Contract produces two possible signatures.
  const signatures = await adapter.sign(viemHash);
  for (const sig of signatures) {
    if (
      ethers.recoverAddress(hash, sig).toLocaleLowerCase() ===
      adapter.address.toLocaleLowerCase()
    ) {
      return sig;
    }
  }
  throw new Error("Invalid signature!");
}

async function sendUserOperation(userOp: unknown, entryPoint: string) {
  const requestPayload = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_sendUserOperation",
      id: 4337,
      params: [userOp, entryPoint],
    }),
  };
  console.log("Request Body", requestPayload.body);
  const response = await fetch(ERC4337_BUNDLER_URL!, requestPayload);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send user op ${body}`);
  }
  const json = JSON.parse(body);
  if (json.error) {
    throw new Error(JSON.stringify(json.error));
  }
  return json.result;
}

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");

  const safeDeployment = (fn: DeploymentFunction) =>
    getDeployment(fn, { provider, version: "1.4.1" });
  const m4337Deployment = (fn: DeploymentFunction) =>
    getDeployment(fn, { provider, version: "0.3.0" });
  const contracts = {
    singleton: await safeDeployment(getSafeL2SingletonDeployment),
    proxyFactory: await safeDeployment(getProxyFactoryDeployment),
    m4337: await m4337Deployment(getSafe4337ModuleDeployment),
    moduleSetup: await m4337Deployment(getSafeModuleSetupDeployment),
    entryPoint: new ethers.Contract(
      // "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
      [`function getNonce(address, uint192 key) view returns (uint256 nonce)`],
      provider,
    ),
  };

  const nearAdapter = await NearEthAdapter.fromConfig({
    mpcContract: await MultichainContract.fromEnv(),
  });

  const setup = await contracts.singleton.interface.encodeFunctionData(
    "setup",
    [
      [nearAdapter.address],
      1,
      contracts.moduleSetup.target,
      contracts.moduleSetup.interface.encodeFunctionData("enableModules", [
        [contracts.m4337.target],
      ]),
      contracts.m4337.target,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ],
  );
  const safeAddress =
    await contracts.proxyFactory.createProxyWithNonce.staticCall(
      contracts.singleton,
      setup,
      SAFE_SALT_NONCE,
    );
  console.log("Safe Address:", safeAddress);

  const safeNotDeployed = (await provider.getCode(safeAddress)) === "0x";
  const { maxPriorityFeePerGas, maxFeePerGas } = await provider.getFeeData();
  if (!maxPriorityFeePerGas || !maxFeePerGas) {
    throw new Error("no gas fee data");
  }
  const unsignedUserOp = {
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
      ethers.ZeroAddress,
      0,
      "0x",
      0,
    ]),
    verificationGasLimit: ethers.toBeHex(safeNotDeployed ? 1_000_000 : 200_000),
    callGasLimit: ethers.toBeHex(200_000),
    preVerificationGas: ethers.toBeHex(200_000),
    maxPriorityFeePerGas: ethers.toBeHex((maxPriorityFeePerGas * 13n) / 10n),
    maxFeePerGas: ethers.toBeHex(maxFeePerGas),
    // TODO(bh2smith): Use paymaster at some point
    //paymaster: paymasterAddress,
    //paymasterGasLimit: ethers.toBeHex(100000),
    //paymasterData: paymasterCallData,
  };
  console.log(unsignedUserOp);

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
    paymasterAndData: "0x",
    signature: ethers.solidityPacked(["uint48", "uint48"], [0, 0]),
  });
  console.log(safeOpHash);

  // const signature =
  //   "0xef028109f94aabaf9cd4fb7f2cce311527567341d3439a40fe15e6e01c45249b790e5e5c1f0803f668219f97a95947a982e4f88d8f9abc675adcdb926ed7504d1c";
  const signature = await getNearSignature(nearAdapter, safeOpHash);
  console.log(
    await sendUserOperation(
      asERC4337Payload({ ...unsignedUserOp, signature }),
      await contracts.entryPoint.getAddress(),
    ),
  );
}

interface UserOpData {
  sender: string;
  nonce: string;
  factory?: string | ethers.Addressable;
  factoryData?: string | ethers.Addressable;
  callData: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  signature: string;
}

interface SendUserOpPayload {
  sender: string;
  nonce: string;
  initCode: string;
  callData: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
  paymasterAndData: string;
  signature: string;
}

function asERC4337Payload(input: UserOpData): SendUserOpPayload {
  let initCode: string;
  if (input.factory && input.factoryData) {
    initCode = input.factory
      .toString()
      .concat(input.factoryData.toString().slice(2));
  } else if (input.factory || input.factoryData) {
    throw new Error("Must have both or neither (factory, factoryData)");
  } else {
    initCode = "0x";
  }
  return {
    sender: input.sender,
    nonce: input.nonce,
    initCode,
    callData: input.callData,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
    verificationGasLimit: input.verificationGasLimit,
    callGasLimit: input.callGasLimit,
    preVerificationGas: input.preVerificationGas,
    paymasterAndData: "0x", // Setting default value for paymasterAndData
    signature: input.signature,
  };
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
