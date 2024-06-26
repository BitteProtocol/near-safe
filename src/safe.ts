import { Safe4337Pack } from "@safe-global/relay-kit";
import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";
import { ethers } from "ethers";

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

/**
 * All contracts used in account creation & execution
 */
interface ContractSuite {
  singleton: ethers.Contract;
  proxyFactory: ethers.Contract;
  m4337: ethers.Contract;
  moduleSetup: ethers.Contract;
  entryPoint: ethers.Contract;
}

export async function loadContracts(
  provider: ethers.JsonRpcProvider,
): Promise<ContractSuite> {
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
  return contracts;
}

export async function getSetupCallData(
  contracts: ContractSuite,
  address: string,
): Promise<string> {
  const setupData = await contracts.singleton.interface.encodeFunctionData(
    "setup",
    [
      [address],
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
  return setupData;
}

export async function getSafeAddressForSetup(
  contracts: ContractSuite,
  setup: ethers.BytesLike,
  saltNonce?: string,
): Promise<ethers.AddressLike> {
  // bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
  // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L58
  const salt = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "uint256"],
      [ethers.keccak256(setup), saltNonce || 0],
    ),
  );

  // abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
  // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L29
  const initCode = ethers.solidityPacked(
    ["bytes", "uint256"],
    [
      await contracts.proxyFactory.proxyCreationCode(),
      await contracts.singleton.getAddress(),
    ],
  );
  return ethers.getCreate2Address(
    await contracts.proxyFactory.getAddress(),
    salt,
    ethers.keccak256(initCode),
  );
}

export interface ExtendedSafePack {
  safe4337Pack: Safe4337Pack;
  contracts: ContractSuite;
  setupData: string;
}

export async function safePackFromEnv(
  provider: ethers.JsonRpcProvider,
  owner: string,
): Promise<ExtendedSafePack> {
  const { SAFE_SALT_NONCE, ERC4337_BUNDLER_URL, ETH_RPC } = process.env;
  const safe4337Pack = await Safe4337Pack.init({
    provider: ETH_RPC!,
    rpcUrl: ETH_RPC!,
    bundlerUrl: ERC4337_BUNDLER_URL!,
    options: {
      owners: [owner],
      threshold: 1,
      saltNonce: SAFE_SALT_NONCE,
    },
  });
  const contracts = await loadContracts(provider);
  const setupData = await getSetupCallData(contracts, owner);
  return { safe4337Pack, contracts, setupData };
}
