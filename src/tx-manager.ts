import { FinalExecutionOutcome } from "near-api-js/lib/providers";
import {
  NearEthAdapter,
  NearEthTxData,
  BaseTx,
  setupAdapter,
  signatureFromOutcome,
} from "near-ca";
import { Address, Hash, Hex, serializeSignature } from "viem";

import { Erc4337Bundler } from "./lib/bundler";
import { encodeMulti } from "./lib/multisend";
import { ContractSuite } from "./lib/safe";
import { MetaTransaction, UserOperation, UserOperationReceipt } from "./types";
import { getClient, isContract, packSignature } from "./util";

export class TransactionManager {
  readonly nearAdapter: NearEthAdapter;
  readonly address: Address;

  private safePack: ContractSuite;
  private setup: string;
  private pimlicoKey: string;
  private safeSaltNonce: string;
  private deployedChains: Set<number>;

  constructor(
    nearAdapter: NearEthAdapter,
    safePack: ContractSuite,
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

  static async create(config: {
    accountId: string;
    mpcContractId: string;
    pimlicoKey: string;
    privateKey?: string;
    safeSaltNonce?: string;
  }): Promise<TransactionManager> {
    const { pimlicoKey } = config;
    const [nearAdapter, safePack] = await Promise.all([
      setupAdapter({ ...config }),
      ContractSuite.init(),
    ]);
    console.log(
      `Near Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`
    );
    const setup = safePack.getSetup([nearAdapter.address]);
    const safeAddress = await safePack.addressForSetup(
      setup,
      config.safeSaltNonce
    );
    console.log(`Safe Address: ${safeAddress}`);
    return new TransactionManager(
      nearAdapter,
      safePack,
      pimlicoKey,
      setup,
      safeAddress,
      config.safeSaltNonce || "0"
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

  async encodeSignRequest(tx: BaseTx): Promise<NearEthTxData> {
    const unsignedUserOp = await this.buildTransaction({
      chainId: tx.chainId,
      transactions: [
        {
          to: tx.to!,
          value: (tx.value || 0n).toString(),
          data: tx.data || "0x",
        },
      ],
      usePaymaster: true,
    });
    const safeOpHash = (await this.opHash(unsignedUserOp)) as `0x${string}`;
    const signRequest = await this.nearAdapter.encodeSignRequest({
      method: "hash",
      chainId: 0,
      params: safeOpHash as `0x${string}`,
    });
    return {
      ...signRequest,
      evmMessage: JSON.stringify(unsignedUserOp),
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
}
