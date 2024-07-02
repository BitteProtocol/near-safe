import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import { Erc4337Bundler } from "./lib/bundler.js";
import { packSignature } from "./util.js";
import { getNearSignature } from "./lib/near.js";
import { UserOperation, UserOperationReceipt, UserOptions } from "./types.js";
import { MetaTransaction, encodeMulti } from "ethers-multisend";
import { ContractSuite } from "./lib/safe.js";

export class TransactionManager {
  readonly provider: ethers.JsonRpcProvider;
  readonly nearAdapter: NearEthAdapter;
  private safePack: ContractSuite;
  private bundler: Erc4337Bundler;
  private setup: string;
  readonly safeAddress: string;
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
    this.safeAddress = safeAddress;
    this.safeSaltNonce = safeSaltNonce;
    this._safeNotDeployed = safeNotDeployed;
  }

  static async create(config: {
    ethRpc: string;
    erc4337BundlerUrl: string;
    safeSaltNonce?: string;
  }): Promise<TransactionManager> {
    const provider = new ethers.JsonRpcProvider(config.ethRpc);
    const [nearAdapter, safePack] = await Promise.all([
      NearEthAdapter.fromConfig({
        mpcContract: await MultichainContract.fromEnv(),
      }),
      ContractSuite.init(provider),
    ]);
    console.log(
      `Near Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`
    );
    const bundler = new Erc4337Bundler(
      config.erc4337BundlerUrl,
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

  get safeNotDeployed(): boolean {
    return this._safeNotDeployed;
  }

  get nearEOA(): `0x${string}` {
    return this.nearAdapter.address;
  }

  async getSafeBalance(): Promise<bigint> {
    return await this.provider.getBalance(this.safeAddress);
  }

  async buildTransaction(args: {
    transactions: MetaTransaction[];
    options: UserOptions;
  }): Promise<{ safeOpHash: string; unsignedUserOp: UserOperation }> {
    const { transactions, options } = args;
    const gasFees = (await this.bundler.getGasPrice()).fast;
    // const gasFees = await this.provider.getFeeData();
    // Build Singular MetaTransaction for Multisend from transaction list.
    const tx =
      transactions.length > 1 ? encodeMulti(transactions) : transactions[0];
    const rawUserOp = await this.safePack.buildUserOp(
      tx,
      this.safeAddress,
      gasFees,
      this.setup,
      this.safeNotDeployed,
      this.safeSaltNonce
    );

    const paymasterData = await this.bundler.getPaymasterData(
      rawUserOp,
      options.usePaymaster,
      this.safeNotDeployed
    );

    const unsignedUserOp = { ...rawUserOp, ...paymasterData };
    const safeOpHash = await this.safePack.getOpHash(
      unsignedUserOp,
      paymasterData
    );

    return {
      safeOpHash,
      unsignedUserOp,
    };
  }

  async signTransaction(safeOpHash: string): Promise<string> {
    const signature = await getNearSignature(this.nearAdapter, safeOpHash);
    return packSignature(signature);
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
      (await this.provider.getCode(this.safeAddress)) === "0x";
    return userOpReceipt;
  }

  addOwnerTx(address: string): MetaTransaction {
    return {
      to: this.safeAddress,
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
