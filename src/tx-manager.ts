import { ethers } from "ethers";
import { NearEthAdapter, MultichainContract } from "near-ca";
import { ContractSuite } from "./safe";
import { Erc4337Bundler } from "./bundler";
import { packSignature } from "./util";
import { getNearSignature } from "./near";
import { UserOperation, UserOptions } from "./types";

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
    safeNotDeployed: boolean,
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
    recoveryAddress?: string;
  }): Promise<TransactionManager> {
    const provider = new ethers.JsonRpcProvider(config.ethRpc);
    const [nearAdapter, safePack] = await Promise.all([
      NearEthAdapter.fromConfig({
        mpcContract: await MultichainContract.fromEnv(),
      }),
      ContractSuite.init(provider),
    ]);
    console.log(
      `Near Adapter: ${nearAdapter.nearAccountId()} <> ${nearAdapter.address}`,
    );
    const bundler = new Erc4337Bundler(
      config.erc4337BundlerUrl,
      await safePack.entryPoint.getAddress(),
    );
    // TODO(bh2smith): add the recovery as part of the first tx (more deterministic)
    const owners = [
      nearAdapter.address,
      ...(config.recoveryAddress ? [config.recoveryAddress] : []),
    ];
    const setup = await safePack.getSetup(owners);
    const safeAddress = await safePack.addressForSetup(
      setup,
      config.safeSaltNonce,
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
      safeNotDeployed,
    );
  }

  static async fromEnv(options: UserOptions): Promise<TransactionManager> {
    return TransactionManager.create({
      ethRpc: process.env.ETH_RPC!,
      erc4337BundlerUrl: process.env.ERC4337_BUNDLER_URL!,
      safeSaltNonce: options.safeSaltNonce,
    });
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
    transaction: { to: `0x${string}`; value: bigint; data: `0x${string}` };
    options: UserOptions;
  }): Promise<{ safeOpHash: string; unsignedUserOp: UserOperation }> {
    const gasFees = await this.provider.getFeeData();
    const { to, value, data } = args.transaction;
    const rawUserOp = await this.safePack.buildUserOp(
      { to, value, data },
      this.safeAddress,
      gasFees,
      this.setup,
      this.safeNotDeployed,
      this.safeSaltNonce,
    );

    const paymasterData = await this.bundler.getPaymasterData(
      rawUserOp,
      args.options.usePaymaster,
      this.safeNotDeployed,
    );

    const unsignedUserOp = { ...rawUserOp, ...paymasterData };
    const safeOpHash = await this.safePack.getOpHash(
      unsignedUserOp,
      paymasterData,
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

  async executeTransaction(userOp: UserOperation) {
    const userOpHash = await this.bundler.sendUserOperation(userOp);
    console.log("UserOp Hash", userOpHash);

    const userOpReceipt = await this.bundler.getUserOpReceipt(userOpHash);
    console.log("userOp Receipt", userOpReceipt);

    // Update safeNotDeployed after the first transaction
    this._safeNotDeployed =
      (await this.provider.getCode(this.safeAddress)) === "0x";
    return userOpReceipt;
  }

  async assertFunded(usePaymaster: boolean): Promise<void> {
    if (this.safeNotDeployed && !usePaymaster) {
      const safeBalance = await this.getSafeBalance();
      if (safeBalance === 0n) {
        console.log(
          `WARN: Undeployed Safe (${this.safeAddress}) must be funded when not using paymaster`,
        );
        process.exit(0);
      }
    }
  }
}
