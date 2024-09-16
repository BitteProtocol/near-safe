import { NearEthAdapter, NearEthTxData, BaseTx, Network } from "near-ca";
import { Erc4337Bundler } from "./lib/bundler";
import { packSignature } from "./util";
import { UserOperation, UserOperationReceipt } from "./types";
import { MetaTransaction, encodeMulti } from "ethers-multisend";
import { ContractSuite } from "./lib/safe";
import { Address, Hash, Hex } from "viem";

export class TransactionManager {
  readonly nearAdapter: NearEthAdapter;
  readonly address: Address;
  readonly entryPointAddress: Address;

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
    entryPointAddress: Address,
    safeSaltNonce: string
  ) {
    this.nearAdapter = nearAdapter;
    this.safePack = safePack;
    this.pimlicoKey = pimlicoKey;
    this.entryPointAddress = entryPointAddress;
    this.setup = setup;
    this.address = safeAddress;
    this.safeSaltNonce = safeSaltNonce;
    this.deployedChains = new Set();
  }

  static async create(config: {
    pimlicoKey: string;
    nearAdapter: NearEthAdapter;
    safeSaltNonce?: string;
  }): Promise<TransactionManager> {
    const { nearAdapter, pimlicoKey } = config;
    const safePack = await ContractSuite.init();
    console.log(
      `Near Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`
    );
    const setup = await safePack.getSetup([nearAdapter.address]);
    const safeAddress = await safePack.addressForSetup(
      setup,
      config.safeSaltNonce
    );
    const entryPointAddress =
      (await safePack.entryPoint.getAddress()) as Address;
    console.log(`Safe Address: ${safeAddress}`);
    return new TransactionManager(
      nearAdapter,
      safePack,
      pimlicoKey,
      setup,
      safeAddress,
      entryPointAddress,
      config.safeSaltNonce || "0"
    );
  }

  get mpcAddress(): Address {
    return this.nearAdapter.address;
  }

  async getBalance(chainId: number): Promise<bigint> {
    const provider = Network.fromChainId(chainId).client;
    return await provider.getBalance({ address: this.address });
  }

  bundlerForChainId(chainId: number) {
    return new Erc4337Bundler(this.entryPointAddress, this.pimlicoKey, chainId);
  }

  async buildTransaction(args: {
    chainId: number;
    transactions: MetaTransaction[];
    usePaymaster: boolean;
  }): Promise<UserOperation> {
    const { transactions, usePaymaster, chainId } = args;
    const bundler = this.bundlerForChainId(chainId);
    const gasFees = (await bundler.getGasPrice()).fast;
    // Build Singular MetaTransaction for Multisend from transaction list.
    if (transactions.length === 0) {
      throw new Error("Empty transaction set!");
    }
    const tx =
      transactions.length > 1 ? encodeMulti(transactions) : transactions[0]!;
    const safeNotDeployed = !(await this.safeDeployed(chainId));
    const rawUserOp = await this.safePack.buildUserOp(
      tx,
      this.address,
      gasFees,
      this.setup,
      safeNotDeployed,
      this.safeSaltNonce
    );

    const paymasterData = await bundler.getPaymasterData(
      rawUserOp,
      usePaymaster,
      safeNotDeployed
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
    if (chainId in this.deployedChains) {
      return true;
    }
    const provider = Network.fromChainId(chainId).client;
    const deployed =
      (await provider.getCode({ address: this.address })) !== "0x";
    if (deployed) {
      this.deployedChains.add(chainId);
    }
    return deployed;
  }

  addOwnerTx(address: string): MetaTransaction {
    return {
      to: this.address,
      value: "0",
      data: this.safePack.singleton.interface.encodeFunctionData(
        "addOwnerWithThreshold",
        [address, 1]
      ),
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
}
