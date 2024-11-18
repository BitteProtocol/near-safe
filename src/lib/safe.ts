import {
  Address,
  concat,
  createPublicClient,
  encodeFunctionData,
  encodePacked,
  getAddress,
  getCreate2Address,
  Hash,
  Hex,
  http,
  keccak256,
  parseAbi,
  PublicClient,
  toHex,
  zeroAddress,
} from "viem";

import { SAFE_DEPLOYMENTS } from "../_gen/deployments";
import {
  DEFAULT_SETUP_RPC,
  SENTINEL_OWNERS,
  USER_OP_IDENTIFIER,
} from "../constants";
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
  setupClient: PublicClient;
  singleton: Deployment;
  proxyFactory: Deployment;
  m4337: Deployment;
  moduleSetup: Deployment;
  entryPoint: Deployment;

  constructor(rpcUrl: string = DEFAULT_SETUP_RPC) {
    this.setupClient = createPublicClient({ transport: http(rpcUrl) });
    const deployments = SAFE_DEPLOYMENTS;
    this.singleton = deployments.singleton;
    this.proxyFactory = deployments.proxyFactory;
    this.m4337 = deployments.m4337;
    this.moduleSetup = deployments.moduleSetup;
    this.entryPoint = deployments.entryPoint;
  }

  async addressForSetup(setup: Hex, saltNonce: string): Promise<Address> {
    // bytes32 salt = keccak256(abi.encodePacked(keccak256(initializer), saltNonce));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L58
    const salt = keccak256(
      encodePacked(
        ["bytes32", "uint256"],
        [keccak256(setup), BigInt(saltNonce)]
      )
    );
    // abi.encodePacked(type(SafeProxy).creationCode, uint256(uint160(_singleton)));
    // cf: https://github.com/safe-global/safe-smart-account/blob/499b17ad0191b575fcadc5cb5b8e3faeae5391ae/contracts/proxies/SafeProxyFactory.sol#L29
    const initCode = encodePacked(
      ["bytes", "uint256"],
      [
        (await this.setupClient.readContract({
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
        owners, // _owners
        1, // _threshold
        this.moduleSetup.address, // to
        encodeFunctionData({
          abi: this.moduleSetup.abi,
          functionName: "enableModules",
          args: [[this.m4337.address]],
        }), // data
        this.m4337.address, // fallbackHandler
        zeroAddress, // paymentToken
        0, // payment
        zeroAddress, // paymentReceiver
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

  async removeOwnerData(
    chainId: number,
    safeAddress: Address,
    owner: Address
  ): Promise<Hex> {
    const prevOwner = await this.prevOwner(chainId, safeAddress, owner);
    return encodeFunctionData({
      abi: this.singleton.abi,
      functionName: "removeOwner",
      // Keep threshold at 1!
      args: [prevOwner, owner, 1],
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
      callData: concat([
        encodeFunctionData({
          abi: this.m4337.abi,
          functionName: "executeUserOp",
          args: [
            getAddress(txData.to),
            BigInt(txData.value),
            txData.data,
            txData.operation || 0,
          ],
        }),
        // Append On-Chain Identifier:
        USER_OP_IDENTIFIER,
      ]),
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

  async prevOwner(
    chainId: number,
    safeAddress: Address,
    owner: Address
  ): Promise<Address> {
    const client = getClient(chainId);
    const currentOwners = await client.readContract({
      address: safeAddress,
      // abi: this.singleton.abi,
      abi: parseAbi([
        "function getOwners() public view returns (address[] memory)",
      ]),
      functionName: "getOwners",
    });
    const ownerIndex = currentOwners.findIndex((t) => t === owner);
    if (ownerIndex === -1) {
      throw new Error(`Not a current owner: ${owner}`);
    }
    return ownerIndex > 0 ? currentOwners[ownerIndex - 1]! : SENTINEL_OWNERS;
  }
}
