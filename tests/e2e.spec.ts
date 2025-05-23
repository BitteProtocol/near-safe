import dotenv from "dotenv";
import { isHex, zeroAddress } from "viem";

import { DEFAULT_SAFE_SALT_NONCE, NearSafe } from "../src";
import { decodeTxData } from "../src/decode";
import { Pimlico } from "../src/lib/pimlico";

dotenv.config();

const TESTNET_ROOT_KEY =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";
// const MAINNET_ROOT_KEY =
//   "secp256k1:3tFRbMqmoa6AAALMrEFAYCEoHcqKxeW38YptwowBVBtXK1vo36HDbUWuR6EZmoK4JcH6HDkNMGGqP1ouV7VZUWya";

describe("Near Safe Requests", () => {
  let adapter: NearSafe;
  beforeAll(async () => {
    // Initialize the NearSafe adapter once before all tests
    adapter = await NearSafe.create({
      mpc: {
        accountId: "neareth-dev.testnet",
        mpcContractId: "v1.signer-prod.testnet",
        rootPublicKey: TESTNET_ROOT_KEY,
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

  it("pimlico: getSponsorshipPolicies", async () => {
    const pimlico = new Pimlico(process.env.PIMLICO_KEY!);
    await expect(pimlico.getSponsorshipPolicies()).resolves.not.toThrow();
    await expect(
      pimlico.getSponsorshipPolicyByName("bitte-policy")
    ).resolves.not.toThrow();
  });

  it("pimlico: getSponsorshipPolicies failures", async () => {
    await expect(
      new Pimlico("Invalid Key").getSponsorshipPolicies()
    ).rejects.toThrow();

    const pimlico = new Pimlico(process.env.PIMLICO_KEY!);
    await expect(
      pimlico.getSponsorshipPolicyByName("poop-policy")
    ).rejects.toThrow("No policy found with policy_name=");
    await expect(
      pimlico.getSponsorshipPolicyById("invalid id")
    ).rejects.toThrow("No policy found with id=");
  });

  it("bundler: policiesForChainId", async () => {
    await expect(adapter.policiesForChainId(100)).resolves.not.toThrow();
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
    // eslint-disable-next-line quotes
    const typedDataString = `{\"types\":{\"SafeTx\":[{\"name\":\"to\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"data\",\"type\":\"bytes\"},{\"name\":\"operation\",\"type\":\"uint8\"},{\"name\":\"safeTxGas\",\"type\":\"uint256\"},{\"name\":\"baseGas\",\"type\":\"uint256\"},{\"name\":\"gasPrice\",\"type\":\"uint256\"},{\"name\":\"gasToken\",\"type\":\"address\"},{\"name\":\"refundReceiver\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"}],\"EIP712Domain\":[{\"name\":\"chainId\",\"type\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\"}]},\"domain\":{\"chainId\":\"0xaa36a7\",\"verifyingContract\":\"0x7fa8e8264985c7525fc50f98ac1a9b3765405489\"},\"primaryType\":\"SafeTx\",\"message\":{\"to\":\"0x102543f7e6b5786a444cc89ff73012825d13000d\",\"value\":\"100000000000000000\",\"data\":\"0x\",\"operation\":\"0\",\"safeTxGas\":\"0\",\"baseGas\":\"0\",\"gasPrice\":\"0\",\"gasToken\":\"0x0000000000000000000000000000000000000000\",\"refundReceiver\":\"0x0000000000000000000000000000000000000000\",\"nonce\":\"0\"}}`;
    const { evmData } = await adapter.encodeSignRequest({
      chainId: 11155111,
      method: "eth_signTypedData_v4",
      params: [adapter.mpcAddress, typedDataString],
    });
    expect(() => decodeTxData({ ...evmData })).not.toThrow();

    expect(evmData).toStrictEqual({
      chainId: 11155111,
      hashToSign:
        "0x5c395ac0d1ccc0727918d636e8faca7eec2758cc9928c8a8d96e4f58aba453c5",
      evmMessage: typedDataString,
    });
  });

  it("adapter: encodeEvmTx Uniswap V3", async () => {
    const chainId = 43114;
    const request = await adapter.requestRouter({
      method: "eth_signTypedData_v4",
      params: [
        zeroAddress,
        // eslint-disable-next-line quotes
        '{"types":{"PermitSingle":[{"name":"details","type":"PermitDetails"},{"name":"spender","type":"address"},{"name":"sigDeadline","type":"uint256"}],"PermitDetails":[{"name":"token","type":"address"},{"name":"amount","type":"uint160"},{"name":"expiration","type":"uint48"},{"name":"nonce","type":"uint48"}],"EIP712Domain":[{"name":"name","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}]},"domain":{"name":"Permit2","chainId": 43114,"verifyingContract":"0x000000000022d473030f116ddee9f6b43ac78ba3"},"primaryType":"PermitSingle","message":{"details":{"token":"0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e","amount":"1461501637330902918203684832716283019655932542975","expiration":"1739457501","nonce":"0"},"spender":"0x4dae2f939acf50408e13d58534ff8c2776d45265","sigDeadline":"1736867301"}}',
      ],
      chainId,
    });
    expect(() =>
      decodeTxData({ evmMessage: request.evmMessage, chainId })
    ).not.toThrow();
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
    expect(nearPayload.actions[0]!.params.args).toStrictEqual({
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
