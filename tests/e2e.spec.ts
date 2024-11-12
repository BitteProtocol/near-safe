import dotenv from "dotenv";
import { isHex } from "viem";

import { DEFAULT_SAFE_SALT_NONCE, NearSafe } from "../src";
import { decodeTxData } from "../src/decode";

dotenv.config();

describe("Near Safe Requests", () => {
  let adapter: NearSafe;
  beforeAll(async () => {
    // Initialize the NearSafe adapter once before all tests
    adapter = await NearSafe.create({
      mpc: {
        accountId: "neareth-dev.testnet",
        mpcContractId: "v1.signer-prod.testnet",
      },
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
            from: adapter.address,
            to: "0xD0A1E359811322d97991E03f863a0C30C2cF029C",
            data: "0xd0e30db0",
            value: "0x16345785d8a0000",
          },
        ],
      })
    ).resolves.not.toThrow();

    const typedDataString =
      '{"types":{"SafeTx":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"operation","type":"uint8"},{"name":"safeTxGas","type":"uint256"},{"name":"baseGas","type":"uint256"},{"name":"gasPrice","type":"uint256"},{"name":"gasToken","type":"address"},{"name":"refundReceiver","type":"address"},{"name":"nonce","type":"uint256"}],"EIP712Domain":[{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}]},"domain":{"chainId":"0xaa36a7","verifyingContract":"0x7fa8e8264985c7525fc50f98ac1a9b3765405489"},"primaryType":"SafeTx","message":{"to":"0x102543f7e6b5786a444cc89ff73012825d13000d","value":"100000000000000000","data":"0x","operation":"0","safeTxGas":"0","baseGas":"0","gasPrice":"0","gasToken":"0x0000000000000000000000000000000000000000","refundReceiver":"0x0000000000000000000000000000000000000000","nonce":"0"}}';
    const { evmData } = await adapter.encodeSignRequest({
      chainId: 11155111,
      method: "eth_signTypedData_v4",
      params: [adapter.mpcAddress, typedDataString],
    });
    console.log(evmData);
    expect(() => decodeTxData({ ...evmData })).not.toThrow();

    expect(evmData).toStrictEqual({
      chainId: 11155111,
      hashToSign:
        "0x5c395ac0d1ccc0727918d636e8faca7eec2758cc9928c8a8d96e4f58aba453c5",
      evmMessage: typedDataString,
    });
  });

  it("adapter: requestRouter", async () => {
    const { evmMessage } = await adapter.requestRouter({
      method: "eth_sendTransaction",
      chainId: 11155111,
      params: [
        {
          gas: "0x1ad80",
          // TODO - Upgrade SessionRequestParams Type. (i.e. don't overwrite prepopulated gas fields!)
          // maxFeePerGas: "0x65ae4691",
          // maxPriorityFeePerGas: "0xfc363",
          // nonce: "0x29",
          from: "0x102543f7e6b5786a444cc89ff73012825d13000d",
          to: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
          data: "0x6a7612020000000000000000000000007fa8e8264985c7525fc50f98ac1a9b37654054890000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000007f01d9b227593e033bf8d6fc86e634d27aa855680000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041000000000000000000000000102543f7e6b5786a444cc89ff73012825d13000d00000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000",
        },
      ],
    });
    expect(isHex(evmMessage)).toBe(true);
  });

  it("adapter: encodeSignRequest", async () => {
    const typedDataString = `
    {"types":{"SafeTx":[{"name":"to","type":"address"},{"name":"value","type":"uint256"},{"name":"data","type":"bytes"},{"name":"operation","type":"uint8"},{"name":"safeTxGas","type":"uint256"},{"name":"baseGas","type":"uint256"},{"name":"gasPrice","type":"uint256"},{"name":"gasToken","type":"address"},{"name":"refundReceiver","type":"address"},{"name":"nonce","type":"uint256"}],"EIP712Domain":[{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}]},"domain":{"chainId":"0xaa36a7","verifyingContract":"0x7fa8e8264985c7525fc50f98ac1a9b3765405489"},"primaryType":"SafeTx","message":{"to":"0x7fa8e8264985c7525fc50f98ac1a9b3765405489","value":"0","data":"0xf8dc5dd900000000000000000000000000000000000000000000000000000000000000010000000000000000000000007f01d9b227593e033bf8d6fc86e634d27aa855680000000000000000000000000000000000000000000000000000000000000001","operation":"0","safeTxGas":"0","baseGas":"0","gasPrice":"0","gasToken":"0x0000000000000000000000000000000000000000","refundReceiver":"0x0000000000000000000000000000000000000000","nonce":"0"}}
    `;
    const { nearPayload, evmData } = await adapter.encodeSignRequest({
      chainId: 11155111,
      method: "eth_signTypedData_v4",
      params: [adapter.mpcAddress, typedDataString],
    });
    expect(nearPayload.actions[0].params.args).toStrictEqual({
      request: {
        path: "ethereum,1",
        payload: [
          250, 14, 89, 231, 28, 246, 94, 76, 240, 231, 202, 130, 5, 82, 150,
          147, 223, 248, 253, 230, 35, 100, 110, 59, 215, 1, 48, 87, 44, 57, 22,
          216,
        ],
        key_version: 0,
      },
    });
    expect(evmData).toStrictEqual({
      chainId: 11155111,
      evmMessage: typedDataString,
      hashToSign:
        "0xfa0e59e71cf65e4cf0e7ca8205529693dff8fde623646e3bd70130572c3916d8",
    });
  });
});
