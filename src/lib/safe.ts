import {
  Address,
  encodeFunctionData,
  encodePacked,
  getCreate2Address,
  Hash,
  Hex,
  keccak256,
  PublicClient,
  toHex,
  zeroAddress,
} from "viem";

import { SAFE_DEPLOYMENTS } from "../_gen/deployments";
import {
  Deployment,
  GasPrice,
  MetaTransaction,
  UnsignedUserOperation,
  UserOperation,
} from "../types";
import {
  PLACEHOLDER_SIG,
  getClient,
  packGas,
  packPaymasterData,
} from "../util";

/**
 * All contracts used in account creation & execution
 */
export class SafeContractSuite {
  // Used only for stateless contract reads.
  dummyClient: PublicClient;
  singleton: Deployment;
  proxyFactory: Deployment;
  m4337: Deployment;
  moduleSetup: Deployment;
  entryPoint: Deployment;

  constructor() {
    this.dummyClient = getClient(11155111);
    const deployments = SAFE_DEPLOYMENTS;
    this.singleton = deployments.singleton;
    this.proxyFactory = deployments.proxyFactory;
    this.m4337 = deployments.m4337;
    this.moduleSetup = deployments.moduleSetup;
    this.entryPoint = deployments.entryPoint;
  }

  async addressForSetup(setup: Hex, saltNonce?: string): Promise<Address> {
    // bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L58
    const salt = keccak256(
      encodePacked(
        ["bytes32", "uint256"],
        [keccak256(setup), BigInt(saltNonce || "0")]
      )
    );

    // abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L29
    const initCode = encodePacked(
      ["bytes", "uint256"],
      [
        (await this.dummyClient.readContract({
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

  async getOpHash(
    chainId: number,
    unsignedUserOp: UserOperation
  ): Promise<Hash> {
    const {
      factory,
      factoryData,
      verificationGasLimit,
      callGasLimit,
      maxPriorityFeePerGas,
      maxFeePerGas,
    } = unsignedUserOp;
    const client = await getClient(chainId);
    const opHash = await client.readContract({
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
    nonce: bigint,
    txData: MetaTransaction,
    safeAddress: Address,
    feeData: GasPrice,
    setup: string,
    safeNotDeployed: boolean,
    safeSaltNonce: string
  ): Promise<UnsignedUserOperation> {
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

  async getNonce(address: Address, chainId: number): Promise<bigint> {
    const nonce = (await getClient(chainId).readContract({
      abi: this.entryPoint.abi,
      address: this.entryPoint.address,
      functionName: "getNonce",
      args: [address, 0],
    })) as bigint;
    return nonce;
  }
}
