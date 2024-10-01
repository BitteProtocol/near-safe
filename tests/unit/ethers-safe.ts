import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";
import { ethers } from "ethers";
import { Address, Hash, Hex } from "viem";

import {
  GasPrice,
  MetaTransaction,
  UnsignedUserOperation,
  UserOperation,
} from "../../src/types";
import { PLACEHOLDER_SIG, packGas, packPaymasterData } from "../../src/util";

/**
 * All contracts used in account creation & execution
 */
export class ContractSuite {
  provider: ethers.JsonRpcProvider;
  singleton: ethers.Contract;
  proxyFactory: ethers.Contract;
  m4337: ethers.Contract;
  moduleSetup: ethers.Contract;
  entryPoint: ethers.Contract;

  constructor(
    provider: ethers.JsonRpcProvider,
    singleton: ethers.Contract,
    proxyFactory: ethers.Contract,
    m4337: ethers.Contract,
    moduleSetup: ethers.Contract,
    entryPoint: ethers.Contract
  ) {
    this.provider = provider;
    this.singleton = singleton;
    this.proxyFactory = proxyFactory;
    this.m4337 = m4337;
    this.moduleSetup = moduleSetup;
    this.entryPoint = entryPoint;
  }

  static async init(): Promise<ContractSuite> {
    // TODO - this is a cheeky hack.
    const provider = new ethers.JsonRpcProvider("https://rpc2.sepolia.org");
    const safeDeployment = (fn: DeploymentFunction): Promise<ethers.Contract> =>
      getDeployment(fn, { provider, version: "1.4.1" });
    const m4337Deployment = async (
      fn: DeploymentFunction
    ): Promise<ethers.Contract> => {
      return getDeployment(fn, { provider, version: "0.3.0" });
    };
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
      ["function getNonce(address, uint192 key) view returns (uint256 nonce)"],
      provider
    );
    console.log("Initialized ERC4337 & Safe Module Contracts:", {
      singleton: await singleton.getAddress(),
      proxyFactory: await proxyFactory.getAddress(),
      m4337: await m4337.getAddress(),
      moduleSetup: await moduleSetup.getAddress(),
      entryPoint: await entryPoint.getAddress(),
    });
    return new ContractSuite(
      provider,
      singleton,
      proxyFactory,
      m4337,
      moduleSetup,
      entryPoint
    );
  }

  async addressForSetup(
    setup: ethers.BytesLike,
    saltNonce?: string
  ): Promise<Address> {
    // bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L58
    const salt = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256"],
        [ethers.keccak256(setup), saltNonce || 0]
      )
    );

    // abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L29
    const initCode = ethers.solidityPacked(
      ["bytes", "uint256"],
      [
        await this.proxyFactory.proxyCreationCode(),
        await this.singleton.getAddress(),
      ]
    );
    return ethers.getCreate2Address(
      await this.proxyFactory.getAddress(),
      salt,
      ethers.keccak256(initCode)
    ) as Address;
  }

  getSetup(owners: string[]): Hex {
    return this.singleton.interface.encodeFunctionData("setup", [
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
    ]) as Hex;
  }

  addOwnerData(newOwner: Address): Hex {
    return this.singleton.interface.encodeFunctionData(
      "addOwnerWithThreshold",
      [newOwner, 1]
    ) as Hex;
  }

  async getOpHash(unsignedUserOp: UserOperation): Promise<Hash> {
    const {
      factory,
      factoryData,
      verificationGasLimit,
      callGasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = unsignedUserOp;
    return this.m4337.getOperationHash({
      ...unsignedUserOp,
      initCode: factory
        ? ethers.solidityPacked(["address", "bytes"], [factory, factoryData])
        : "0x",
      accountGasLimits: packGas(verificationGasLimit, callGasLimit),
      gasFees: packGas(maxPriorityFeePerGas, maxFeePerGas),
      paymasterAndData: packPaymasterData(unsignedUserOp),
      signature: PLACEHOLDER_SIG,
    });
  }

  factoryDataForSetup(
    safeNotDeployed: boolean,
    setup: string,
    safeSaltNonce: string
  ): { factory?: Address; factoryData?: Hex } {
    return safeNotDeployed
      ? {
          factory: this.proxyFactory.target as Address,
          factoryData: this.proxyFactory.interface.encodeFunctionData(
            "createProxyWithNonce",
            [this.singleton.target, setup, safeSaltNonce]
          ) as Hex,
        }
      : {};
  }

  async buildUserOp(
    txData: MetaTransaction,
    safeAddress: Address,
    feeData: GasPrice,
    setup: string,
    safeNotDeployed: boolean,
    safeSaltNonce: string
  ): Promise<UnsignedUserOperation> {
    const rawUserOp = {
      sender: safeAddress,
      nonce: ethers.toBeHex(await this.entryPoint.getNonce(safeAddress, 0)),
      ...this.factoryDataForSetup(safeNotDeployed, setup, safeSaltNonce),
      // <https://github.com/safe-global/safe-modules/blob/9a18245f546bf2a8ed9bdc2b04aae44f949ec7a0/modules/4337/contracts/Safe4337Module.sol#L172>
      callData: this.m4337.interface.encodeFunctionData("executeUserOp", [
        txData.to,
        BigInt(txData.value),
        txData.data,
        txData.operation || 0,
      ]) as Hex,
      ...feeData,
    };
    return rawUserOp;
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
  { provider, version }: DeploymentArgs
): Promise<ethers.Contract> {
  const { chainId } = await provider.getNetwork();
  const deployment = fn({ version });
  if (!deployment) {
    throw new Error(
      `Deployment not found for ${fn.name} version ${version} on chainId ${chainId}`
    );
  }
  let address = deployment.networkAddresses[`${chainId}`];
  if (!address) {
    // console.warn(
    //   `Deployment asset ${fn.name} not listed on chainId ${chainId}, using likely fallback. For more info visit https://github.com/safe-global/safe-modules-deployments`
    // );
    // TODO: This is a cheeky hack. Real solution proposed in
    // https://github.com/Mintbase/near-safe/issues/42
    address = deployment.networkAddresses["11155111"];
  }
  return new ethers.Contract(
    address,
    deployment.abi as ethers.Fragment[],
    provider
  );
}
