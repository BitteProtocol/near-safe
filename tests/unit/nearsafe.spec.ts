import { NearSafe } from "../../src";
describe("NearSafe", () => {
  it("decodeTxData (singular)", async () => {
    const adapter = await NearSafe.create({
      accountId: "neareth-dev.testnet",
      mpcContractId: "v1.signer-prod.testnet",
      pimlicoKey: "dummyKey",
    });
    const txData = {
      chainId: 11155111,
      data: JSON.stringify({
        sender: "0x4184cabfD63Da66828dE8486FE20DC015D800BbB",
        nonce: "0xc",
        callData:
          "0x7bb374280000000000000000000000008d99f8b2710e6a3b94d9bf465a98e5273069acbd0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002B00B000000000000000000000000000000000000000000000000000000000000",
        maxFeePerGas: "0x3575104828",
        maxPriorityFeePerGas: "0x47868c00",
        paymaster: "0x0000000000000039cd5e8aE05257CE51C473ddd1",
        paymasterData:
          "0x00000066fd3196000000000000ec1da1a540e872a6b82ad0e5622ff24e06f5a928477aa2f3c9655c1a92c2ed7f153b8bcb8e5ad52f734a58d498b60d58bd307f1d2ccbd5115f09773d804cbc0c1b",
        preVerificationGas: "0xd257",
        verificationGasLimit: "0x138b1",
        callGasLimit: "0x14a6a",
        paymasterVerificationGasLimit: "0x6c8e",
        paymasterPostOpGasLimit: "0x1",
      }),
      hash: "0xfcfe9c2a4a5faade2bb5e9e483eece0fee77760db1698a6eb8060d1d33c56377",
    };
    expect(adapter.decodeTxData(txData)).toStrictEqual({
      chainId: 11155111,
      costEstimate: "0.019522217711724688",
      transactions: [
        {
          data: "0xb00b",
          operation: 0,
          to: "0x8d99F8b2710e6A3B94d9bf465A98E5273069aCBd",
          value: 0n,
        },
      ],
    });
  });

  it("decodeTxData (multi)", async () => {
    const adapter = await NearSafe.create({
      accountId: "neareth-dev.testnet",
      mpcContractId: "v1.signer-prod.testnet",
      pimlicoKey: "dummyKey",
    });
    const txData = {
      chainId: 11155111,
      data: JSON.stringify({
        sender: "0x575a9D13B206EaF9d621c8626252ac32F72c1133",
        nonce: "0x0",
        factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
        factoryData:
          "0x1688f0b900000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c7620000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001e4b63e800d000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000010000000000000000000000002dd68b007b46fbe91b9a7c3eda5a7a1063cb5b47000000000000000000000000000000000000000000000000000000000000014000000000000000000000000075cf11467937ce3f2f357ce24ffc3dbf8fd5c2260000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000569361e38aca310a578a5b3a271496849749490800000000000000000000000000000000000000000000000000000000000000648d0dc49f0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000075cf11467937ce3f2f357ce24ffc3dbf8fd5c2260000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        callData:
          "0x7bb374280000000000000000000000009641d764fc13c8b624c04430c7356c1c7c8102e200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000001a48d80ff0a0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000014c00beef4dad0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000003b00b1e0099999999999999999999999999999999999999990000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000611112222444400575a9d13b206eaf9d621c8626252ac32f72c1133000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000007f01d9b227593e033bf8d6fc86e634d27aa855680000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        maxFeePerGas: "0x3fba4b0a48",
        maxPriorityFeePerGas: "0x47868c00",
        verificationGasLimit: "0x7a120",
        callGasLimit: "0x186a0",
        preVerificationGas: "0x186a0",
      }),
      hash: "0xb931864e6c59e44ad2753ef07dcb2dc98436119be90e69599b19b516175ac7f1",
    };

    expect(adapter.decodeTxData(txData)).toStrictEqual({
      chainId: 11155111,
      costEstimate: "0.0274908419656",
      transactions: [
        {
          operation: 0,
          to: "0xbeEf4Dad00000000000000000000000000000000",
          value: "0x01",
          data: "0xb00b1e",
        },
        {
          operation: 0,
          to: "0x9999999999999999999999999999999999999999",
          value: "0x00",
          data: "0x111122224444",
        },
        {
          operation: 0,
          to: "0x575a9D13B206EaF9d621c8626252ac32F72c1133",
          value: "0x00",
          data: "0x0d582f130000000000000000000000007f01d9b227593e033bf8d6fc86e634d27aa855680000000000000000000000000000000000000000000000000000000000000001",
        },
      ],
    });
  });
});