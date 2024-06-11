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

dotenv.config();
const { NEAR_EVM_ADDRESS, SAFE_SALT_NONCE, ERC4337_BUNDLER_URL } = process.env;

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

async function getNearSignature(hash: ethers.BytesLike) {
  // TODO(bh2smith): do your thing
  //assert(ethers.recoverAddress(hash, "0x...") === NEAR_EVM_ADDRESS);
  return ethers.solidityPacked(["uint256", "uint256", "uint8"], [1, 2, 27]);
}

async function sendUserOperation(userOp: unknown, entryPoint: string) {
  const response = await fetch(ERC4337_BUNDLER_URL!, {
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
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send user op ${body}`);
  }
  const json = JSON.parse(body);
  if (json.error) {
    throw new Error(json.error.message ?? JSON.stringify(json.error));
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
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
      [`function getNonce(address, uint192 key) view returns (uint256 nonce)`],
      provider,
    ),
  };

  const setup = await contracts.singleton.interface.encodeFunctionData(
    "setup",
    [
      [NEAR_EVM_ADDRESS],
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
    verificationGasLimit: ethers.toBeHex(safeNotDeployed ? 500000 : 100000),
    callGasLimit: ethers.toBeHex(100000),
    preVerificationGas: ethers.toBeHex(100000),
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

  const signature = await getNearSignature(safeOpHash);
  console.log(
    await sendUserOperation(
      { ...unsignedUserOp, signature },
      await contracts.entryPoint.getAddress(),
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
