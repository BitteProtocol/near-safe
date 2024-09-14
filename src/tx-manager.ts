import { ethers } from "ethers";
import { NearEthAdapter, NearEthTxData, BaseTx, Network } from "near-ca";
import { Erc4337Bundler } from "./lib/bundler";
import { packSignature } from "./util";
import { getNearSignature } from "./lib/near";
import { UserOperation, UserOperationReceipt } from "./types";
import { MetaTransaction, encodeMulti } from "ethers-multisend";
import { ContractSuite } from "./lib/safe";

export class TransactionManager {
  readonly provider: ethers.JsonRpcProvider;
  readonly nearAdapter: NearEthAdapter;
  private safePack: ContractSuite;
  private bundler: Erc4337Bundler;
  private setup: string;
  readonly address: string;
  private safeSaltNonce: string;
  private _safeNotDeployed: boolean;

  constructor(
    provider: ethers.JsonRpcProvider,
    nearAdapter: NearEthAdapter,
    safePack: ContractSuite,
    bundler: Erc4337Bundler,
    setup: string,
    safeAddress: string,
    safeSaltNonce: string,
    safeNotDeployed: boolean
  ) {
    this.provider = provider;
    this.nearAdapter = nearAdapter;
    this.safePack = safePack;
    this.bundler = bundler;
    this.setup = setup;
    this.address = safeAddress;
    this.safeSaltNonce = safeSaltNonce;
    this._safeNotDeployed = safeNotDeployed;
  }

  static async create(config: {
    ethRpc: string;
    pimlicoKey: string;
    nearAdapter: NearEthAdapter;
    safeSaltNonce?: string;
  }): Promise<TransactionManager> {
    const { nearAdapter, pimlicoKey } = config;
    const provider = new ethers.JsonRpcProvider(config.ethRpc);
    const chainId = (await provider.getNetwork()).chainId;
    const safePack = await ContractSuite.init(provider);
    console.log(
      `Near Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`
    );
    const bundler = new Erc4337Bundler(
      `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${pimlicoKey}`,
      await safePack.entryPoint.getAddress()
    );
    const setup = await safePack.getSetup([nearAdapter.address]);
    const safeAddress = await safePack.addressForSetup(
      setup,
      config.safeSaltNonce
    );
    const safeNotDeployed = (await provider.getCode(safeAddress)) === "0x";
    console.log(`Safe Address: ${safeAddress} - deployed? ${!safeNotDeployed}`);
    return new TransactionManager(
      provider,
      nearAdapter,
      safePack,
      bundler,
      setup,
      safeAddress,
      config.safeSaltNonce || "0",
      safeNotDeployed
    );
  }

  static async fromChainId(args: {
    chainId: number;
    nearAdapter: NearEthAdapter;
    pimlicoKey: string;
  }): Promise<TransactionManager> {
    const { pimlicoKey, nearAdapter } = args;
    return TransactionManager.create({
      ethRpc: Network.fromChainId(args.chainId).rpcUrl,
      pimlicoKey,
      nearAdapter,
    });
  }

  get safeNotDeployed(): boolean {
    return this._safeNotDeployed;
  }

  get mpcAddress(): `0x${string}` {
    return this.nearAdapter.address;
  }

  async chainId(): Promise<number> {
    const network = await this.provider.getNetwork();
    return parseInt(network.chainId.toString());
  }

  async getSafeBalance(): Promise<bigint> {
    return await this.provider.getBalance(this.address);
  }

  async buildTransaction(args: {
    transactions: MetaTransaction[];
    usePaymaster: boolean;
  }): Promise<UserOperation> {
    const { transactions, usePaymaster } = args;
    const gasFees = (await this.bundler.getGasPrice()).fast;
    // const gasFees = await this.provider.getFeeData();
    // Build Singular MetaTransaction for Multisend from transaction list.
    if (transactions.length === 0) {
      throw new Error("Empty transaction set!");
    }
    const tx =
      transactions.length > 1 ? encodeMulti(transactions) : transactions[0]!;
    const rawUserOp = await this.safePack.buildUserOp(
      tx,
      this.address,
      gasFees,
      this.setup,
      this.safeNotDeployed,
      this.safeSaltNonce
    );

    const paymasterData = await this.bundler.getPaymasterData(
      rawUserOp,
      usePaymaster,
      this.safeNotDeployed
    );

    const unsignedUserOp = { ...rawUserOp, ...paymasterData };

    return unsignedUserOp;
  }

  async signTransaction(safeOpHash: string): Promise<string> {
    const signature = await getNearSignature(this.nearAdapter, safeOpHash);
    return packSignature(signature);
  }

  async opHash(userOp: UserOperation): Promise<string> {
    return this.safePack.getOpHash(userOp);
  }
  async encodeSignRequest(tx: BaseTx): Promise<NearEthTxData> {
    // TODO - This is sloppy and ignores ChainId!
    const unsignedUserOp = await this.buildTransaction({
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
    userOp: UserOperation
  ): Promise<UserOperationReceipt> {
    const userOpHash = await this.bundler.sendUserOperation(userOp);
    console.log("UserOp Hash", userOpHash);

    const userOpReceipt = await this.bundler.getUserOpReceipt(userOpHash);
    console.log("userOp Receipt", userOpReceipt);

    // Update safeNotDeployed after the first transaction
    this._safeNotDeployed =
      (await this.provider.getCode(this.address)) === "0x";
    return userOpReceipt;
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
    const safeBalance = await this.getSafeBalance();
    return txValue + gasCost < safeBalance;
  }
}
