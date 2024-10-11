import { decodeMulti } from "ethers-multisend";
import { NearConfig } from "near-api-js/lib/near";
import { FinalExecutionOutcome } from "near-api-js/lib/providers";
import {
  NearEthAdapter,
  setupAdapter,
  signatureFromOutcome,
  SignRequestData,
  EthSignParams,
  toPayload,
  PersonalSignParams,
} from "near-ca";
import {
  Address,
  decodeFunctionData,
  formatEther,
  Hash,
  Hex,
  serializeSignature,
} from "viem";

import { DEFAULT_SAFE_SALT_NONCE } from "./constants";
import { Erc4337Bundler } from "./lib/bundler";
import { encodeMulti, isMultisendTx } from "./lib/multisend";
import { SafeContractSuite } from "./lib/safe";
import { decodeSafeMessage } from "./lib/safe-message";
import {
  DecodedMultisend,
  EncodedTxData,
  EvmTransactionData,
  MetaTransaction,
  UserOperation,
  UserOperationReceipt,
} from "./types";
import {
  getClient,
  isContract,
  metaTransactionsFromRequest,
  packSignature,
} from "./util";

export interface NearSafeConfig {
  // Adapter Config:
  accountId: string;
  mpcContractId: string;
  nearConfig?: NearConfig;
  privateKey?: string;
  // Safe Config:
  pimlicoKey: string;
  safeSaltNonce?: string;
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
    const { pimlicoKey, safeSaltNonce } = config;
    // const nearAdapter = await mockAdapter();
    const nearAdapter = await setupAdapter({ ...config });
    const safePack = new SafeContractSuite();

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
      safeSaltNonce || DEFAULT_SAFE_SALT_NONCE
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
    usePaymaster: boolean;
  }): Promise<UserOperation> {
    const { transactions, usePaymaster, chainId } = args;
    if (transactions.length === 0) {
      throw new Error("Empty transaction set!");
    }
    console.log(
      `Building UserOp on chainId ${chainId} with ${transactions.length} transaction(s)`
    );
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
      usePaymaster,
      !safeDeployed
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
    usePaymaster: boolean
  ): Promise<EncodedTxData> {
    const { payload, evmMessage, hash } = await this.requestRouter(
      signRequest,
      usePaymaster
    );
    return {
      nearPayload: await this.nearAdapter.mpcContract.encodeSignatureRequestTx({
        path: this.nearAdapter.derivationPath,
        payload,
        key_version: 0,
      }),
      evmData: {
        chainId: signRequest.chainId,
        data: evmMessage,
        hash,
      },
    };
  }

  /**
   * Broadcasts a user operation to the EVM network with a provided signature.
   * Warning: Uses a private ethRPC with sensitive Pimlico API key (should be run server side).
   *
   * @param {number} chainId - The ID of the EVM network to which the transaction should be broadcasted.
   * @param {FinalExecutionOutcome} outcome - The result of the NEAR transaction execution, which contains the necessary data to construct an EVM signature.
   * @param {UserOperation} unsignedUserOp - The unsigned user operation to be broadcasted. This includes transaction data such as the destination address and data payload.
   * @returns {Promise<{ signature: Hex; opHash: Hash }>} - A promise that resolves to an object containing the signature used and the hash of the executed user operation.
   * @throws {Error} - Throws an error if the EVM broadcast fails, including the error message for debugging.
   */
  async broadcastEvm(
    chainId: number,
    outcome: FinalExecutionOutcome,
    unsignedUserOp: UserOperation
  ): Promise<{ signature: Hex; opHash: Hash }> {
    const signature = packSignature(
      serializeSignature(signatureFromOutcome(outcome))
    );
    try {
      return {
        signature,
        opHash: await this.executeTransaction(chainId, {
          ...unsignedUserOp,
          signature,
        }),
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed EVM broadcast: ${error instanceof Error ? error.message : String(error)}`
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
   * Decodes transaction data for a given EVM transaction and extracts relevant details.
   *
   * @param {EvmTransactionData} data - The raw transaction data to be decoded.
   * @returns {{ chainId: number; costEstimate: string; transactions: MetaTransaction[] }} - An object containing the chain ID, estimated cost, and a list of decoded meta-transactions.
   */
  decodeTxData(data: EvmTransactionData): DecodedMultisend {
    // TODO: data.data may not always parse to UserOperation. We will have to handle the other cases.
    const userOp: UserOperation = JSON.parse(data.data);
    const { callGasLimit, maxFeePerGas, maxPriorityFeePerGas } = userOp;
    const maxGasPrice = BigInt(maxFeePerGas) + BigInt(maxPriorityFeePerGas);
    const { args } = decodeFunctionData({
      abi: this.safePack.m4337.abi,
      data: userOp.callData,
    });

    // Determine if singular or double!
    const transactions = isMultisendTx(args)
      ? decodeMulti(args[2] as string)
      : [
          {
            to: args[0],
            value: args[1],
            data: args[2],
            operation: args[3],
          } as MetaTransaction,
        ];
    return {
      chainId: data.chainId,
      // This is an upper bound on the gas fees (could be lower)
      costEstimate: formatEther(BigInt(callGasLimit) * maxGasPrice),
      transactions,
    };
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
    usePaymaster: boolean
  ): Promise<{
    evmMessage: string;
    payload: number[];
    hash: Hash;
  }> {
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
      case "eth_signTypedData_v4":
      case "eth_sign": {
        const [_, messageOrData] = params as EthSignParams;
        const message = decodeSafeMessage(messageOrData, safeInfo);
        return {
          evmMessage: message.safeMessageMessage,
          payload: toPayload(message.safeMessageHash),
          hash: message.safeMessageHash,
        };
      }
      case "personal_sign": {
        const [messageHash, _] = params as PersonalSignParams;
        const message = decodeSafeMessage(messageHash, safeInfo);
        return {
          evmMessage: message.safeMessageMessage,
          payload: toPayload(message.safeMessageHash),
          hash: message.safeMessageHash,
        };
      }
      case "eth_sendTransaction": {
        const transactions = metaTransactionsFromRequest(params);
        const userOp = await this.buildTransaction({
          chainId,
          transactions,
          usePaymaster,
        });
        const opHash = await this.opHash(chainId, userOp);
        return {
          payload: toPayload(opHash),
          evmMessage: JSON.stringify(userOp),
          hash: await this.opHash(chainId, userOp),
        };
      }
    }
  }
}
