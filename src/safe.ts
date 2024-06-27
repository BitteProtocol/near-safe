import { ethers } from "ethers";
import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";

/**
 * All contracts used in account creation & execution
 */
export class ContractSuite {
  singleton: ethers.Contract;
  proxyFactory: ethers.Contract;
  m4337: ethers.Contract;
  moduleSetup: ethers.Contract;
  entryPoint: ethers.Contract;

  constructor(
    singleton: ethers.Contract,
    proxyFactory: ethers.Contract,
    m4337: ethers.Contract,
    moduleSetup: ethers.Contract,
    entryPoint: ethers.Contract,
  ) {
    this.singleton = singleton;
    this.proxyFactory = proxyFactory;
    this.m4337 = m4337;
    this.moduleSetup = moduleSetup;
    this.entryPoint = entryPoint;
  }

  static async init(provider: ethers.JsonRpcProvider): Promise<ContractSuite> {
    const safeDeployment = (fn: DeploymentFunction) =>
      getDeployment(fn, { provider, version: "1.4.1" });
    const m4337Deployment = (fn: DeploymentFunction) =>
      getDeployment(fn, { provider, version: "0.3.0" });
    // Need this first to get entryPoint address
    const m4337 = await m4337Deployment(getSafe4337ModuleDeployment);

    const [singleton, proxyFactory, moduleSetup, supportedEntryPoint] =
      await Promise.all([
        safeDeployment(getSafeL2SingletonDeployment),
        safeDeployment(getProxyFactoryDeployment),
        m4337Deployment(getSafeModuleSetupDeployment),
        m4337.SUPPORTED_ENTRYPOINT(),
      ]);
    const entryPoint = new ethers.Contract(
      supportedEntryPoint,
      [`function getNonce(address, uint192 key) view returns (uint256 nonce)`],
      provider,
    );
    return new ContractSuite(
      singleton,
      proxyFactory,
      m4337,
      moduleSetup,
      entryPoint,
    );
  }

  async getSafeAddressForSetup(
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
        await this.proxyFactory.proxyCreationCode(),
        await this.singleton.getAddress(),
      ],
    );
    return ethers.getCreate2Address(
      await this.proxyFactory.getAddress(),
      salt,
      ethers.keccak256(initCode),
    );
  }

  async getSetup(owners: string[]): Promise<string> {
    const setup = await this.singleton.interface.encodeFunctionData("setup", [
      owners,
      1, // We use sign threshold of 1.
      this.moduleSetup.target,
      this.moduleSetup.interface.encodeFunctionData("enableModules", [
        [this.m4337.target],
      ]),
      this.m4337.target,
      ethers.ZeroAddress,
      0,
      ethers.ZeroAddress,
    ]);
    return setup;
  }
}

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
