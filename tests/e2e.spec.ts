import dotenv from "dotenv";

import { DEFAULT_SAFE_SALT_NONCE, NearSafe } from "../src";

dotenv.config();

describe("Near Safe Requests", () => {
  let adapter: NearSafe;
  beforeAll(async () => {
    // Initialize the NearSafe adapter once before all tests
    adapter = await NearSafe.create({
      accountId: "neareth-dev.testnet",
      mpcContractId: "v1.signer-prod.testnet",
      pimlicoKey: process.env.PIMLICO_KEY!,
      safeSaltNonce: DEFAULT_SAFE_SALT_NONCE,
    });
  });

  it("buildTransaction", async () => {
    const irrelevantData = {
      data: "0xbeef",
      value: "0",
    };
    await expect(
      adapter.buildTransaction({
        chainId: 11155111,
        transactions: [
          {
            to: adapter.mpcAddress,
            ...irrelevantData,
          },
        ],
      })
    ).resolves.not.toThrow();
    // Can't send sponsored raw messages to Safe Contracts.
    // Because transaction simulation reverts.
    await expect(
      adapter.buildTransaction({
        chainId: 11155111,
        transactions: [
          {
            to: adapter.address,
            ...irrelevantData,
          },
        ],
        sponsorshipPolicy: "sp_clear_vampiro",
      })
    ).rejects.toThrow();
  });

  it("bundler: getSponsorshipPolicy", async () => {
    await expect(adapter.policyForChainId(100)).resolves.not.toThrow();
  });

  it("adapter: encodeEvmTx", async () => {
    await expect(
      adapter.encodeSignRequest({
        method: "eth_sendTransaction",
        chainId: 11155111,
        params: [
          {
            from: "0x0000000000000000000000000000000000000000",
            to: "0xD0A1E359811322d97991E03f863a0C30C2cF029C",
            data: "0xd0e30db0",
            value: "0x16345785d8a0000",
          },
        ],
      })
    ).resolves.not.toThrow();
  });

  it("adapter: decodeTxData", async () => {
    // setup:
    const chainId = 11155111;
    const expectedMessage =
      "Welcome to OpenSea!\n" +
      "\n" +
      "Click to sign in and accept the OpenSea Terms of Service (https://opensea.io/tos) and Privacy Policy (https://opensea.io/privacy).\n" +
      "\n" +
      "This request will not trigger a blockchain transaction or cost any gas fees.\n" +
      "\n" +
      "Wallet address:\n" +
      "0xf057e37024abe7e6bc04fb4f00978613b5ca0241\n" +
      "\n" +
      "Nonce:\n" +
      "aca09a1c-a800-4d71-98ed-547f7c59370c";

    const signRequest = await adapter.encodeSignRequest({
      method: "personal_sign",
      chainId,
      params: [
        "0x57656c636f6d6520746f204f70656e536561210a0a436c69636b20746f207369676e20696e20616e642061636365707420746865204f70656e536561205465726d73206f662053657276696365202868747470733a2f2f6f70656e7365612e696f2f746f732920616e64205072697661637920506f6c696379202868747470733a2f2f6f70656e7365612e696f2f70726976616379292e0a0a5468697320726571756573742077696c6c206e6f742074726967676572206120626c6f636b636861696e207472616e73616374696f6e206f7220636f737420616e792067617320666565732e0a0a57616c6c657420616464726573733a0a3078663035376533373032346162653765366263303466623466303039373836313362356361303234310a0a4e6f6e63653a0a61636130396131632d613830302d346437312d393865642d353437663763353933373063",
        "0xf057e37024abe7e6bc04fb4f00978613b5ca0241",
      ],
    });

    expect(signRequest.evmData).toStrictEqual({
      chainId,
      hash: "0xb3a14f9bd21518d7da23dba01ddf7c7ef45795ca1515f1b41b6f3455c862e22d",
      data: expectedMessage,
    });

    expect(adapter.decodeTxData(signRequest.evmData)).toStrictEqual({
      chainId: 11155111,
      costEstimate: "0",
      transactions: [],
      message: expectedMessage,
    });
  });
});
