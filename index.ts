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
const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL, ETH_RPC } = process.env;

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

async function sendUserOperation(userOp: UserOperation, entryPoint: string) {
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
    throw new Error(JSON.stringify(json.error));
  }
  // This does not contain a transaction receipt! It is the `userOpHash`
  return json.result;
}

async function getUserOpReceipt(userOpHash: string) {
  const response = await fetch(ERC4337_BUNDLER_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getUserOperationReceipt",
      id: 4337,
      params: [userOpHash],
    }),
  });
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
  const provider = new ethers.JsonRpcProvider(ETH_RPC);
  const nearAdapter = await NearEthAdapter.fromConfig({
    mpcContract: await MultichainContract.fromEnv(),
  });
  console.log(
    `NearEth Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`,
  );

  const safeDeployment = (fn: DeploymentFunction) =>
    getDeployment(fn, { provider, version: "1.4.1" });
  const m4337Deployment = (fn: DeploymentFunction) =>
    getDeployment(fn, { provider, version: "0.3.0" });
  // Need this first to get entryPoint address
  const m4337 = await m4337Deployment(getSafe4337ModuleDeployment);
  const contracts = {
    singleton: await safeDeployment(getSafeL2SingletonDeployment),
    proxyFactory: await safeDeployment(getProxyFactoryDeployment),
    m4337,
    moduleSetup: await m4337Deployment(getSafeModuleSetupDeployment),
    entryPoint: new ethers.Contract(
      await m4337.SUPPORTED_ENTRYPOINT(),
      [`function getNonce(address, uint192 key) view returns (uint256 nonce)`],
      provider,
    ),
  };

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
  let safeAddress: ethers.AddressLike;
  try {
    safeAddress = await contracts.proxyFactory.createProxyWithNonce.staticCall(
      contracts.singleton,
      setup,
      SAFE_SALT_NONCE,
    );
  } catch (err: unknown) {
    // TODO(bh2smith) - use // ethers.getCreate2Address(_from, _salt, _initCodeHash)
    // Alternative (cheat) is to use safe tx api:
    // https://safe-transaction-sepolia.safe.global/api/v1/owners/${nearAdapter.address}/safes/
    // but this is not necessarily unique!
    safeAddress = "0xDcf56F5a8Cc380f63b6396Dbddd0aE9fa605BeeE";
  }
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
      nearAdapter.address,
      1n, // 1 wei
      "0x626832736d6974682077757a20686572652c207369676e696e672066726f6d204e656172", // bh2smith wuz here, signing from Near
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
  // console.log("Unsigned UserOp", unsignedUserOp);

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
  console.log("Safe Op Hash", safeOpHash);
  console.log("Signing with Near...");
  const signature = ethers.solidityPacked(
    ["uint48", "uint48", "bytes"],
    [0, 0, await getNearSignature(nearAdapter, safeOpHash)],
  );
  const userOpHash = await sendUserOperation(
    { ...unsignedUserOp, signature },
    await contracts.entryPoint.getAddress(),
  );
  console.log("UserOp Hash", userOpHash);
  // TODO(bh2smith) this is returning null because we are requesting it too soon!
  // Maybe better to `eth_getUserOperationByHash` (although this also returns null).
  const userOpReceipt = await getUserOpReceipt(userOpHash);
  console.log("userOp Receipt", userOpReceipt);
}

/**
 * Supported Representation of UserOperation for EntryPoint v0.7
 */
interface UserOperation {
  sender: ethers.AddressLike;
  nonce: string;
  factory?: ethers.AddressLike;
  factoryData?: ethers.BytesLike;
  callData: string;
  verificationGasLimit: string;
  callGasLimit: string;
  preVerificationGas: string;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  signature: string;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
