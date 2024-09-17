import {
  getProxyFactoryDeployment,
  getSafeL2SingletonDeployment,
} from "@safe-global/safe-deployments";
import {
  getSafe4337ModuleDeployment,
  getSafeModuleSetupDeployment,
} from "@safe-global/safe-modules-deployments";
import { Network } from "near-ca";
import {
  Address,
  encodeFunctionData,
  encodePacked,
  getCreate2Address,
  Hash,
  Hex,
  keccak256,
  ParseAbi,
  parseAbi,
  PublicClient,
  toHex,
  zeroAddress,
} from "viem";

import {
  GasPrice,
  MetaTransaction,
  UnsignedUserOperation,
  UserOperation,
} from "../types";
import { PLACEHOLDER_SIG, packGas, packPaymasterData } from "../util";

interface DeploymentData {
  abi: unknown[] | ParseAbi<readonly string[]>;
  address: `0x${string}`;
}

/**
 * All contracts used in account creation & execution
 */
export class ContractSuite {
  client: PublicClient;
  singleton: DeploymentData;
  proxyFactory: DeploymentData;
  m4337: DeploymentData;
  moduleSetup: DeploymentData;
  entryPoint: DeploymentData;

  constructor(
    client: PublicClient,
    singleton: DeploymentData,
    proxyFactory: DeploymentData,
    m4337: DeploymentData,
    moduleSetup: DeploymentData,
    entryPoint: DeploymentData
  ) {
    this.client = client;
    this.singleton = singleton;
    this.proxyFactory = proxyFactory;
    this.m4337 = m4337;
    this.moduleSetup = moduleSetup;
    this.entryPoint = entryPoint;
  }

  static async init(): Promise<ContractSuite> {
    // TODO - this is a cheeky hack.
    const client = Network.fromChainId(11155111).client;
    const safeDeployment = (fn: DeploymentFunction): Promise<DeploymentData> =>
      getDeployment(fn, { version: "1.4.1" });
    const m4337Deployment = async (
      fn: DeploymentFunction
    ): Promise<DeploymentData> => {
      return getDeployment(fn, { version: "0.3.0" });
    };

    const [singleton, proxyFactory, moduleSetup, m4337] = await Promise.all([
      safeDeployment(getSafeL2SingletonDeployment),
      safeDeployment(getProxyFactoryDeployment),
      m4337Deployment(getSafeModuleSetupDeployment),
      m4337Deployment(getSafe4337ModuleDeployment),
    ]);

    // console.log("Initialized ERC4337 & Safe Module Contracts:", {
    //   singleton: await singleton.getAddress(),
    //   proxyFactory: await proxyFactory.getAddress(),
    //   m4337: await m4337.getAddress(),
    //   moduleSetup: await moduleSetup.getAddress(),
    //   entryPoint: await entryPoint.getAddress(),
    // });
    return new ContractSuite(
      client,
      singleton,
      proxyFactory,
      m4337,
      moduleSetup,
      // EntryPoint:
      {
        address: (await client.readContract({
          address: m4337.address,
          abi: m4337.abi,
          functionName: "SUPPORTED_ENTRYPOINT",
        })) as Address,
        abi: parseAbi([
          "function getNonce(address, uint192 key) view returns (uint256 nonce)",
        ]),
      }
    );
  }

  async addressForSetup(setup: Hex, saltNonce?: string): Promise<Address> {
    // bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L58
    const salt = keccak256(encodePacked(
        ["bytes32", "uint256"],
        [keccak256(setup), BigInt(saltNonce || "0")]
      )
    );

    // abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L29
    const initCode = encodePacked(
      ["bytes", "uint256"],
      [
        (await this.client.readContract({
          address: this.proxyFactory.address,
          abi: this.proxyFactory.abi,
          functionName: "proxyCreationCode",
        })) as Hex,
        BigInt(this.singleton.address),
      ]
    );
    return getCreate2Address({
      from: this.proxyFactory.address,
      salt,
      bytecodeHash: keccak256(initCode),
    });
  }

  
  getSetup(owners: string[]): Hex {
    return encodeFunctionData({
      abi: this.singleton.abi,
      functionName: "setup",
      args: [
        owners,
        1, // We use sign threshold of 1.
        this.moduleSetup.address,
        encodeFunctionData({
          abi: this.moduleSetup.abi,
          functionName: "enableModules",
          args: [[this.m4337.address]],
        }),
        this.m4337.address,
        zeroAddress,
        0,
        zeroAddress,
      ],
    });
  }

  addOwnerData(newOwner: Address): Hex {
    return encodeFunctionData({
      abi: this.singleton.abi,
      functionName: "addOwnerWithThreshold",
      args: [newOwner, 1],
    });
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
    const opHash = await this.client.readContract({
      address: this.m4337.address,
      abi: this.m4337.abi,
      functionName: "getOperationHash",
      args: [
        {
          ...unsignedUserOp,
          initCode: factory
            ? encodePacked(["address", "bytes"], [factory, factoryData!])
            : "0x",
          accountGasLimits: packGas(verificationGasLimit, callGasLimit),
          gasFees: packGas(maxPriorityFeePerGas, maxFeePerGas),
          paymasterAndData: packPaymasterData(unsignedUserOp),
          signature: PLACEHOLDER_SIG,
        },
      ],
    });
    return opHash as Hash;
  }

  private factoryDataForSetup(
    safeNotDeployed: boolean,
    setup: string,
    safeSaltNonce: string
  ): { factory?: Address; factoryData?: Hex } {
    return safeNotDeployed
      ? {
          factory: this.proxyFactory.address,
          factoryData: encodeFunctionData({
            abi: this.proxyFactory.abi,
            functionName: "createProxyWithNonce",
            args: [this.singleton.address, setup, safeSaltNonce],
          }),
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
    const nonce = (await this.client.readContract({
      abi: this.entryPoint.abi,
      address: this.entryPoint.address,
      functionName: "getNonce",
      args: [safeAddress, 0],
    })) as bigint;
    return {
      sender: safeAddress,
      nonce: toHex(nonce),
      ...this.factoryDataForSetup(safeNotDeployed, setup, safeSaltNonce),
      // <https://github.com/safe-global/safe-modules/blob/9a18245f546bf2a8ed9bdc2b04aae44f949ec7a0/modules/4337/contracts/Safe4337Module.sol#L172>
      callData: encodeFunctionData({
        abi: this.m4337.abi,
        functionName: "executeUserOp",
        args: [
          txData.to,
          BigInt(txData.value),
          txData.data,
          txData.operation || 0,
        ],
      }),
      ...feeData,
    };
  }
}

type DeploymentFunction = (filter?: {
  version: string;
}) =>
  | { networkAddresses: { [chainId: string]: string }; abi: unknown[] }
  | undefined;
type DeploymentArgs = { version: string };

async function getDeployment(
  fn: DeploymentFunction,
  { version }: DeploymentArgs
): Promise<DeploymentData> {
  const deployment = fn({ version });
  if (!deployment) {
    throw new Error(`Deployment not found for ${fn.name} version ${version}`);
  }
  // TODO: maybe call parseAbi on deployment.abi here.
  return {
    address: deployment.networkAddresses["11155111"] as Address,
    abi: deployment.abi,
  };
}
