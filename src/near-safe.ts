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
import { Address, Hash, Hex, serializeSignature } from "viem";

import { Erc4337Bundler } from "./lib/bundler";
import { encodeMulti } from "./lib/multisend";
import { SafeContractSuite } from "./lib/safe";
import { decodeSafeMessage } from "./lib/safe-message";
import {
  EncodedTxData,
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
  accountId: string;
  mpcContractId: string;
  pimlicoKey: string;
  nearConfig?: NearConfig;
  privateKey?: string;
  safeSaltNonce?: string;
}

export class NearSafe {
  readonly nearAdapter: NearEthAdapter;
  readonly address: Address;

  private safePack: SafeContractSuite;
  private setup: string;
  private pimlicoKey: string;
  private safeSaltNonce: string;
  private deployedChains: Set<number>;

  constructor(
    nearAdapter: NearEthAdapter,
    safePack: SafeContractSuite,
    pimlicoKey: string,
    setup: string,
    safeAddress: Address,
    safeSaltNonce: string
  ) {
    this.nearAdapter = nearAdapter;
    this.safePack = safePack;
    this.pimlicoKey = pimlicoKey;
    this.setup = setup;
    this.address = safeAddress;
    this.safeSaltNonce = safeSaltNonce;
    this.deployedChains = new Set();
  }

  static async create(config: NearSafeConfig): Promise<NearSafe> {
    const { pimlicoKey, safeSaltNonce } = config;
    const [nearAdapter, safePack] = await Promise.all([
      setupAdapter({ ...config }),
      SafeContractSuite.init(),
    ]);

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
      safeSaltNonce || "0"
    );
  }

  get mpcAddress(): Address {
    return this.nearAdapter.address;
  }

  get mpcContractId(): string {
    return this.nearAdapter.mpcContract.contract.contractId;
  }

  async getBalance(chainId: number): Promise<bigint> {
    return await getClient(chainId).getBalance({ address: this.address });
  }

  bundlerForChainId(chainId: number): Erc4337Bundler {
    return new Erc4337Bundler(
      this.safePack.entryPoint.address,
      this.pimlicoKey,
      chainId
    );
  }

  async buildTransaction(args: {
    chainId: number;
    transactions: MetaTransaction[];
    usePaymaster: boolean;
  }): Promise<UserOperation> {
    const { transactions, usePaymaster, chainId } = args;
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
      usePaymaster,
      !safeDeployed
    );

    const unsignedUserOp = { ...rawUserOp, ...paymasterData };

    return unsignedUserOp;
  }

  async signTransaction(safeOpHash: Hex): Promise<Hex> {
    const signature = await this.nearAdapter.sign(safeOpHash);
    return packSignature(signature);
  }

  async opHash(userOp: UserOperation): Promise<Hash> {
    return this.safePack.getOpHash(userOp);
  }

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

  async executeTransaction(
    chainId: number,
    userOp: UserOperation
  ): Promise<UserOperationReceipt> {
    const bundler = this.bundlerForChainId(chainId);
    const userOpHash = await bundler.sendUserOperation(userOp);
    console.log("UserOp Hash", userOpHash);

    const userOpReceipt = await bundler.getUserOpReceipt(userOpHash);
    console.log("userOp Receipt", userOpReceipt);

    // Update safeNotDeployed after the first transaction
    this.safeDeployed(chainId);
    return userOpReceipt;
  }

  async safeDeployed(chainId: number): Promise<boolean> {
    // Early exit if already known.
    if (chainId in this.deployedChains) {
      return true;
    }
    const deployed = await isContract(this.address, chainId);
    if (deployed) {
      this.deployedChains.add(chainId);
    }
    return deployed;
  }

  addOwnerTx(address: Address): MetaTransaction {
    return {
      to: this.address,
      value: "0",
      data: this.safePack.addOwnerData(address),
    };
  }

  async safeSufficientlyFunded(
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

  async broadcastEvm(
    chainId: number,
    outcome: FinalExecutionOutcome,
    unsignedUserOp: UserOperation
  ): Promise<{ signature: Hex; receipt: UserOperationReceipt }> {
    const signature = packSignature(
      serializeSignature(signatureFromOutcome(outcome))
    );
    try {
      return {
        signature,
        receipt: await this.executeTransaction(chainId, {
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
        const opHash = await this.opHash(userOp);
        return {
          payload: toPayload(opHash),
          evmMessage: JSON.stringify(userOp),
          hash: await this.opHash(userOp),
        };
      }
    }
  }
}