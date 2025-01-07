import {
  NearEthAdapter,
  setupAdapter,
  SignRequestData,
  EthSignParams,
  toPayload,
  PersonalSignParams,
  requestRouter as mpcRequestRouter,
  EncodedSignRequest,
  EthTransactionParams,
  SetupConfig as MpcConfig,
} from "near-ca";
import { Address, Hash, Hex, zeroAddress } from "viem";

import { DEFAULT_SAFE_SALT_NONCE } from "./constants";
import { Erc4337Bundler } from "./lib/bundler";
import { encodeMulti } from "./lib/multisend";
import { SafeContractSuite } from "./lib/safe";
import { decodeSafeMessage } from "./lib/safe-message";
import {
  EncodedTxData,
  MetaTransaction,
  SponsorshipPolicyData,
  UserOperation,
  UserOperationReceipt,
} from "./types";
import {
  assertUnique,
  getClient,
  isContract,
  metaTransactionsFromRequest,
  packSignature,
} from "./util";

export interface NearSafeConfig {
  mpc: MpcConfig;
  // Safe Config:
  pimlicoKey: string;
  safeSaltNonce?: string;
  setupRpc?: string;
}

export class NearSafe {
  readonly nearAdapter: NearEthAdapter;
  readonly address: Address;

  private safePack: SafeContractSuite;
  private setup: string;
  private pimlicoKey: string;
  private safeSaltNonce: string;

  /**
   * Creates a new instance of the `NearSafe` class using the provided configuration.
   *
   * @param {NearSafeConfig} config - The configuration object required to initialize the `NearSafe` instance, including the Pimlico key and safe salt nonce.
   * @returns {Promise<NearSafe>} - A promise that resolves to a new `NearSafe` instance.
   */
  static async create(config: NearSafeConfig): Promise<NearSafe> {
    const { pimlicoKey, setupRpc } = config;
    const safeSaltNonce = config.safeSaltNonce || DEFAULT_SAFE_SALT_NONCE;

    // const nearAdapter = await mockAdapter();
    const nearAdapter = await setupAdapter(config.mpc);
    const safePack = new SafeContractSuite(setupRpc);

    const setup = safePack.getSetup([nearAdapter.address]);
    const safeAddress = await safePack.addressForSetup(setup, safeSaltNonce);
    console.log(`
      Near Adapter:
        Near Account ID: ${nearAdapter.nearAccountId()}
        MPC EOA: ${nearAdapter.address}
        Safe: ${safeAddress}
    `);
    return new NearSafe(
      nearAdapter,
      safePack,
      pimlicoKey,
      setup,
      safeAddress,
      safeSaltNonce
    );
  }

  /**
   * Constructs a new `NearSafe` object with the provided parameters.
   *
   * @param {NearEthAdapter} nearAdapter - The NEAR adapter used for interacting with the NEAR blockchain.
   * @param {SafeContractSuite} safePack - A suite of contracts and utilities for managing the Safe contract.
   * @param {string} pimlicoKey - A key required for authenticating with the Pimlico service.
   * @param {string} setup - The setup string generated for the Safe contract.
   * @param {Address} safeAddress - The address of the deployed Safe contract.
   * @param {string} safeSaltNonce - A unique nonce used to differentiate the Safe setup.
   */
  constructor(
    nearAdapter: NearEthAdapter,
    safePack: SafeContractSuite,
    pimlicoKey: string,
    setup: string,
    safeAddress: Address,
    safeSaltNonce: string
  ) {
    this.nearAdapter = nearAdapter;
    this.address = safeAddress;

    this.setup = setup;
    this.safePack = safePack;
    this.pimlicoKey = pimlicoKey;
    this.safeSaltNonce = safeSaltNonce;
  }

  /**
   * Retrieves the MPC (Multi-Party Computation) address associated with the NEAR adapter.
   *
   * @returns {Address} - The MPC address of the NEAR adapter.
   */
  get mpcAddress(): Address {
    return this.nearAdapter.address;
  }

  /**
   * Retrieves the contract ID of the MPC contract associated with the NEAR adapter.
   *
   * @returns {string} - The contract ID of the MPC contract.
   */
  get mpcContractId(): string {
    return this.nearAdapter.mpcContract.accountId();
  }

  /**
   * Retrieves the balance of the Safe account on the specified EVM chain.
   *
   * @param {number} chainId - The ID of the blockchain network where the Safe account is located.
   * @returns {Promise<bigint>} - A promise that resolves to the balance of the Safe account in wei.
   */
  async getBalance(chainId: number): Promise<bigint> {
    return await getClient(chainId).getBalance({ address: this.address });
  }

  /**
   * Constructs a user operation for the specified chain, including necessary gas fees, nonce, and paymaster data.
   * Warning: Uses a private ethRPC with sensitive Pimlico API key (should be run server side).
   *
   * @param {Object} args - The arguments for building the transaction.
   * @param {number} args.chainId - The ID of the blockchain network where the transaction will be executed.
   * @param {MetaTransaction[]} args.transactions - A list of meta-transactions to be included in the user operation.
   * @param {boolean} args.usePaymaster - Flag indicating whether to use a paymaster for gas fees. If true, the transaction will be sponsored by the paymaster.
   * @returns {Promise<UserOperation>} - A promise that resolves to a complete `UserOperation` object, including gas fees, nonce, and paymaster data.
   * @throws {Error} - Throws an error if the transaction set is empty or if any operation fails during the building process.
   */
  async buildTransaction(args: {
    chainId: number;
    transactions: MetaTransaction[];
    sponsorshipPolicy?: string;
  }): Promise<UserOperation> {
    const { transactions, sponsorshipPolicy, chainId } = args;
    if (transactions.length === 0) {
      throw new Error("Empty transaction set!");
    }
    const bundler = this.bundlerForChainId(chainId);
    const [gasFees, nonce, safeDeployed] = await Promise.all([
      bundler.getGasPrice(),
      this.safePack.getNonce(this.address, chainId),
      this.safeDeployed(chainId),
    ]);
    // Build Singular MetaTransaction for Multisend from transaction list.
    const tx =
      transactions.length > 1 ? encodeMulti(transactions) : transactions[0]!;

    const rawUserOp = await this.safePack.buildUserOp(
      nonce,
      tx,
      this.address,
      gasFees.fast,
      this.setup,
      !safeDeployed,
      this.safeSaltNonce
    );

    const paymasterData = await bundler.getPaymasterData(
      rawUserOp,
      sponsorshipPolicy
    );

    const unsignedUserOp = { ...rawUserOp, ...paymasterData };

    return unsignedUserOp;
  }

  /**
   * Signs a transaction with the NEAR adapter using the provided operation hash.
   *
   * @param {Hex} safeOpHash - The hash of the user operation that needs to be signed.
   * @returns {Promise<Hex>} - A promise that resolves to the packed signature in hexadecimal format.
   */
  async signTransaction(safeOpHash: Hex): Promise<Hex> {
    const signature = await this.nearAdapter.sign(safeOpHash);
    return packSignature(signature);
  }

  /**
   * Computes the operation hash for a given user operation.
   *
   * @param {UserOperation} userOp - The user operation for which the hash needs to be computed.
   * @returns {Promise<Hash>} - A promise that resolves to the hash of the provided user operation.
   */
  async opHash(chainId: number, userOp: UserOperation): Promise<Hash> {
    return this.safePack.getOpHash(chainId, userOp);
  }

  /**
   * Encodes a request to sign a transaction using either a paymaster or the user's own funds.
   *
   * @param {SignRequestData} signRequest - The data required to create the signature request. This includes information such as the chain ID and other necessary fields for the transaction.
   * @param {boolean} usePaymaster - Flag indicating whether to use a paymaster for gas fees. If true, the transaction will be sponsored by the paymaster.
   * @returns {Promise<EncodedTxData>} - A promise that resolves to the encoded transaction data for the NEAR and EVM networks.
   */
  async encodeSignRequest(
    signRequest: SignRequestData,
    sponsorshipPolicy?: string
  ): Promise<EncodedTxData> {
    const { evmMessage, hashToSign } = await this.requestRouter(
      signRequest,
      sponsorshipPolicy
    );
    return {
      nearPayload: await this.nearAdapter.mpcContract.encodeSignatureRequestTx({
        path: this.nearAdapter.derivationPath,
        payload: toPayload(hashToSign),
        key_version: 0,
      }),
      evmData: {
        chainId: signRequest.chainId,
        evmMessage,
        hashToSign,
      },
    };
  }

  /**
   * Broadcasts a user operation to the EVM network with a provided signature.
   * Warning: Uses a private ethRPC with sensitive Pimlico API key (should be run server side).
   *
   * @param {number} chainId - The ID of the EVM network to which the transaction should be broadcasted.
   * @param {Signature} signature - The valid signature of the unsignedUserOp.
   * @param {UserOperation} unsignedUserOp - The unsigned user operation to be broadcasted. This includes transaction data such as the destination address and data payload.
   * @returns {Promise<Hash>} - A promise that resolves hash of the executed user operation.
   * @throws {Error} - Throws an error if the EVM broadcast fails, including the error message for debugging.
   */
  async broadcastBundler(
    chainId: number,
    signatureHex: Hex,
    unsignedUserOp: UserOperation
  ): Promise<Hash> {
    try {
      return this.executeTransaction(chainId, {
        ...unsignedUserOp,
        signature: packSignature(signatureHex),
      });
    } catch (error: unknown) {
      throw new Error(
        `Failed Bundler broadcast: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Executes a user operation on the specified blockchain network.
   * Warning: Uses a private ethRPC with sensitive Pimlico API key (should be run server side).
   *
   * @param {number} chainId - The ID of the blockchain network on which to execute the transaction.
   * @param {UserOperation} userOp - The user operation to be executed, typically includes the data and signatures necessary for the transaction.
   * @returns {Promise<Hash>} - A promise that resolves to the hash of the executed transaction.
   */
  async executeTransaction(
    chainId: number,
    userOp: UserOperation
  ): Promise<Hash> {
    return this.bundlerForChainId(chainId).sendUserOperation(userOp);
  }

  /**
   * Retrieves the receipt of a previously executed user operation.
   * Warning: Uses a private ethRPC with sensitive Pimlico API key (should be run server side).
   *
   * @param {number} chainId - The ID of the blockchain network where the operation was executed.
   * @param {Hash} userOpHash - The hash of the user operation for which to retrieve the receipt.
   * @returns {Promise<UserOperationReceipt>} - A promise that resolves to the receipt of the user operation, which includes status and logs.
   */
  async getOpReceipt(
    chainId: number,
    userOpHash: Hash
  ): Promise<UserOperationReceipt> {
    return this.bundlerForChainId(chainId).getUserOpReceipt(userOpHash);
  }

  /**
   * Checks if the Safe contract is deployed on the specified chain.
   *
   * @param {number} chainId - The ID of the blockchain network where the Safe contract should be checked.
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the Safe contract is deployed, otherwise `false`.
   */
  async safeDeployed(chainId: number): Promise<boolean> {
    return isContract(this.address, chainId);
  }

  /**
   * Determines if the Safe account has sufficient funds to cover the transaction costs.
   *
   * @param {number} chainId - The ID of the blockchain network where the Safe account is located.
   * @param {MetaTransaction[]} transactions - A list of meta-transactions to be evaluated for funding.
   * @param {bigint} gasCost - The estimated gas cost of executing the transactions.
   * @returns {Promise<boolean>} - A promise that resolves to `true` if the Safe account has sufficient funds, otherwise `false`.
   */
  async sufficientlyFunded(
    chainId: number,
    transactions: MetaTransaction[],
    gasCost: bigint
  ): Promise<boolean> {
    const txValue = transactions.reduce(
      (acc, tx) => acc + BigInt(tx.value),
      0n
    );
    if (txValue + gasCost === 0n) {
      return true;
    }
    const safeBalance = await this.getBalance(chainId);
    return txValue + gasCost < safeBalance;
  }

  /**
   * Creates a meta-transaction for adding a new owner to the Safe contract.
   *
   * @param {Address} address - The address of the new owner to be added.
   * @returns {MetaTransaction} - A meta-transaction object for adding the new owner.
   */
  addOwnerTx(address: Address): MetaTransaction {
    return {
      to: this.address,
      value: "0",
      data: this.safePack.addOwnerData(address),
    };
  }

  /**
   * Creates a meta-transaction for adding a new owner to the Safe contract.
   *
   * @param {number} chainId - the chainId to build the transaction for.
   * @param {Address} address - The address of the new owner to be removed.
   * @returns {Promise<MetaTransaction>} - A meta-transaction object for adding the new owner.
   */
  async removeOwnerTx(
    chainId: number,
    address: Address
  ): Promise<MetaTransaction> {
    return {
      to: this.address,
      value: "0x00",
      data: await this.safePack.removeOwnerData(chainId, this.address, address),
    };
  }

  /**
   * Creates and returns a new `Erc4337Bundler` instance for the specified chain.
   *
   * @param {number} chainId - The ID of the blockchain network for which the bundler is to be created.
   * @returns {Erc4337Bundler} - A new instance of the `Erc4337Bundler` class configured for the specified chain.
   */
  private bundlerForChainId(chainId: number): Erc4337Bundler {
    return new Erc4337Bundler(
      this.safePack.entryPoint.address,
      this.pimlicoKey,
      chainId
    );
  }

  /**
   * Handles routing of signature requests based on the provided method, chain ID, and parameters.
   *
   * @async
   * @function requestRouter
   * @param {SignRequestData} params - An object containing the method, chain ID, and request parameters.
   * @returns {Promise<{ evmMessage: string; payload: number[]; recoveryData: RecoveryData }>}
   * - Returns a promise that resolves to an object containing the Ethereum Virtual Machine (EVM) message,
   *   the payload (hashed data), and recovery data needed for reconstructing the signature request.
   */
  async requestRouter(
    { method, chainId, params }: SignRequestData,
    sponsorshipPolicy?: string
  ): Promise<EncodedSignRequest> {
    // Extract `from` based on the method and check uniqueness
    const fromAddresses = (() => {
      switch (method) {
        case "eth_signTypedData":
        case "eth_signTypedData_v4":
        case "eth_sign":
          return [(params as EthSignParams)[0]];
        case "personal_sign":
          return [(params as PersonalSignParams)[1]];
        case "eth_sendTransaction":
          return (params as EthTransactionParams[]).map((p) => p.from);
        default:
          return [];
      }
    })();

    // Assert uniqueness
    assertUnique(fromAddresses);
    if (!fromAddresses[0]) {
      throw new Error("No from address provided");
    }
    // Early return with eoaEncoding if `from` is not the Safe
    if (!this.encodeForSafe(fromAddresses[0])) {
      // TODO: near-ca needs to update this for typed data like we did.
      return mpcRequestRouter({ method, chainId, params });
    }

    const safeInfo = {
      address: { value: this.address },
      chainId: chainId.toString(),
      // TODO: Should be able to read this from on chain.
      version: "1.4.1+L2",
    };
    // TODO: We are provided with sender in the input, but also expect safeInfo.
    // We should either confirm they agree or ignore one of the two.
    switch (method) {
      case "eth_signTypedData":
      case "eth_signTypedData_v4": {
        const [_, typedDataString] = params as EthSignParams;
        const message = decodeSafeMessage(
          JSON.parse(typedDataString),
          safeInfo
        );
        return {
          evmMessage: JSON.parse(typedDataString),
          hashToSign: message.safeMessageHash,
        };
      }
      case "eth_sign": {
        const [_, messageOrData] = params as EthSignParams;
        const message = decodeSafeMessage(messageOrData, safeInfo);
        return {
          evmMessage: message.decodedMessage,
          hashToSign: message.safeMessageHash,
        };
      }
      case "personal_sign": {
        const [messageHash, _] = params as PersonalSignParams;
        const message = decodeSafeMessage(messageHash, safeInfo);
        return {
          evmMessage: message.decodedMessage,
          hashToSign: message.safeMessageHash,
        };
      }
      case "eth_sendTransaction": {
        const castParams = params as EthTransactionParams[] | `0x${string}`;
        const transactions = metaTransactionsFromRequest(castParams);
        const userOp = await this.buildTransaction({
          chainId,
          transactions,
          ...(sponsorshipPolicy ? { sponsorshipPolicy } : {}),
        });
        const opHash = await this.opHash(chainId, userOp);
        return {
          evmMessage: JSON.stringify(userOp),
          hashToSign: opHash,
        };
      }
    }
  }

  encodeForSafe(from: string): boolean {
    const lowerFrom = from.toLowerCase();
    const lowerZero = zeroAddress.toLowerCase();
    const lowerSafe = this.address.toLowerCase();
    const lowerMpc = this.mpcAddress.toLowerCase();
    // We allow zeroAddress (and and treat is as from = safe)
    if (![lowerSafe, lowerMpc, lowerZero].includes(lowerFrom)) {
      throw new Error(`Unexpected from address ${from}`);
    }
    return [this.address.toLowerCase(), lowerZero].includes(lowerFrom);
  }

  async policyForChainId(chainId: number): Promise<SponsorshipPolicyData[]> {
    const bundler = this.bundlerForChainId(chainId);
    return bundler.getSponsorshipPolicies();
  }

  deploymentRequest(chainId: number): SignRequestData {
    return {
      method: "eth_sendTransaction",
      chainId,
      params: [
        {
          from: this.address,
          to: zeroAddress,
          value: "0x0",
          data: "0x",
        },
      ],
    };
  }

  addOwnerRequest(chainId: number, recoveryAddress: Address): SignRequestData {
    return {
      method: "eth_sendTransaction",
      chainId,
      params: [
        {
          from: this.address,
          to: this.address,
          value: "0x0",
          data: new SafeContractSuite().addOwnerData(recoveryAddress),
        },
      ],
    };
  }
}
