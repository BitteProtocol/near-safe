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

  it.only("adapter: encodeEvmTx", async () => {
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

    const typedDataString = `{
        \"types\":{\"SafeTx\":[{\"name\":\"to\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"data\",\"type\":\"bytes\"},{\"name\":\"operation\",\"type\":\"uint8\"},{\"name\":\"safeTxGas\",\"type\":\"uint256\"},{\"name\":\"baseGas\",\"type\":\"uint256\"},{\"name\":\"gasPrice\",\"type\":\"uint256\"},{\"name\":\"gasToken\",\"type\":\"address\"},{\"name\":\"refundReceiver\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"}],\"EIP712Domain\":[{\"name\":\"chainId\",\"type\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\"}]},\"domain\":{\"chainId\":\"0xaa36a7\",\"verifyingContract\":\"0x7fa8e8264985c7525fc50f98ac1a9b3765405489\"},\"primaryType\":\"SafeTx\",\"message\":{\"to\":\"0x102543f7e6b5786a444cc89ff73012825d13000d\",\"value\":\"100000000000000000\",\"data\":\"0x\",\"operation\":\"0\",\"safeTxGas\":\"0\",\"baseGas\":\"0\",\"gasPrice\":\"0\",\"gasToken\":\"0x0000000000000000000000000000000000000000\",\"refundReceiver\":\"0x0000000000000000000000000000000000000000\",\"nonce\":\"0\"}
        }`;
    const { evmData } = await adapter.encodeSignRequest({
      chainId: 11155111,
      method: "eth_signTypedData_v4",
      params: ["0x102543f7e6b5786a444cc89ff73012825d13000d", typedDataString],
    });

    expect(evmData).toStrictEqual({
      chainId: 11155111,
      // This will also be fixed by: https://github.com/BitteProtocol/near-ca/pull/142
      hash: "0x",
      data: typedDataString,
    });
  });
});
