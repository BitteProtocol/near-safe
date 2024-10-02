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
});
