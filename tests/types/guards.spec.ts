import { isEIP712TypedData } from "near-ca";

import {
  isUserOperation,
  parseEip712TypedData,
  parseWithTypeGuard,
} from "../../src/";

describe("isUserOperation", () => {
  const validUserOp = {
    nonce: "0x0",
    sender: "0xf87f7247a8228021aD5f778554F583b683450463",
    factory: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    callData:
      "0x7bb374280000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000062697474652f6e6561722d7361666500",
    paymaster: "0x0000000000000039cd5e8aE05257CE51C473ddd1",
    signature:
      "0x000000000000000000000000656340e1592369b8e6863bb60fe679c02f049fd0afad511c66879a265e9b73f3150f2346a442056fbdfcacf0064bcb9475de8939f40366efc0d27ddf594fefac1c",
    factoryData:
      "0x1688f0b900000000000000000000000029fcb43b46531bca003ddc8fcb67ffe91900c76200000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000062697474652f77616c6c65740000000000000000000000000000000000000000000000000000000000000000000001e4",
    callGasLimit: "0x1f02e",
    maxFeePerGas: "0xf4402",
    paymasterData:
      "0x00000067349c22000000000000a022bd9ed9d1348292e4390f5ffad8dd945547c37ab5fd1ce964f979b7210ea467af70db0fba9f76efc17f187b50be0579c6dcf84d5e654e0b21734bd490a3a91c",
    preVerificationGas: "0xeff88",
    maxPriorityFeePerGas: "0xf4240",
    verificationGasLimit: "0x7bac9",
    paymasterPostOpGasLimit: "0x1",
    paymasterVerificationGasLimit: "0x6cab",
  };

  it("should return true for valid UserOperation", () => {
    expect(isUserOperation(validUserOp)).toBe(true);
  });

  it("should return false for missing required fields", () => {
    const testCases = [
      { ...validUserOp, sender: undefined },
      { ...validUserOp, nonce: undefined },
      { ...validUserOp, callData: undefined },
      { ...validUserOp, maxPriorityFeePerGas: undefined },
      { ...validUserOp, maxFeePerGas: undefined },
      { ...validUserOp, verificationGasLimit: undefined },
      { ...validUserOp, callGasLimit: undefined },
      { ...validUserOp, preVerificationGas: undefined },
    ];

    testCases.forEach((testCase) => {
      expect(isUserOperation(testCase)).toBe(false);
    });
  });

  it("should return false for invalid field types", () => {
    const testCases = [
      { ...validUserOp, sender: "not-an-address" },
      { ...validUserOp, nonce: 123 },
      { ...validUserOp, callData: "not-hex" },
      { ...validUserOp, maxPriorityFeePerGas: "not-hex" },
      { ...validUserOp, maxFeePerGas: "not-hex" },
      { ...validUserOp, verificationGasLimit: "not-hex" },
      { ...validUserOp, callGasLimit: "not-hex" },
      { ...validUserOp, preVerificationGas: "not-hex" },
      { ...validUserOp, factory: "not-an-address" },
      { ...validUserOp, factoryData: "not-hex" },
      { ...validUserOp, signature: "not-hex" },
      { ...validUserOp, paymaster: "not-an-address" },
      { ...validUserOp, paymasterData: "not-hex" },
      { ...validUserOp, paymasterVerificationGasLimit: "not-hex" },
      { ...validUserOp, paymasterPostOpGasLimit: "not-hex" },
    ];

    testCases.forEach((testCase) => {
      expect(isUserOperation(testCase)).toBe(false);
    });
  });

  it("should return false for non-object inputs", () => {
    const testCases = [null, undefined, 123, "string", [], true, false];

    testCases.forEach((testCase) => {
      expect(isUserOperation(testCase)).toBe(false);
    });
  });

  it("should handle optional fields correctly", () => {
    const minimalUserOp = {
      sender: validUserOp.sender,
      nonce: validUserOp.nonce,
      callData: validUserOp.callData,
      maxPriorityFeePerGas: validUserOp.maxPriorityFeePerGas,
      maxFeePerGas: validUserOp.maxFeePerGas,
      verificationGasLimit: validUserOp.verificationGasLimit,
      callGasLimit: validUserOp.callGasLimit,
      preVerificationGas: validUserOp.preVerificationGas,
    };

    expect(isUserOperation(minimalUserOp)).toBe(true);
  });
});

describe("parseWithTypeGuard", () => {
  // Example type and guard for testing
  type TestType = { foo: string; bar: number };
  const isTestType = (data: unknown): data is TestType => {
    if (typeof data !== "object" || data === null) return false;
    const candidate = data as Record<string, unknown>;
    return (
      typeof candidate.foo === "string" && typeof candidate.bar === "number"
    );
  };

  const validObject: TestType = { foo: "test", bar: 123 };

  it("should parse valid object directly", () => {
    expect(parseWithTypeGuard(validObject, isTestType)).toStrictEqual(
      validObject
    );
  });

  it("should parse valid stringified object", () => {
    const stringified = JSON.stringify(validObject);
    expect(parseWithTypeGuard(stringified, isTestType)).toStrictEqual(
      validObject
    );
  });

  it("should return null for invalid inputs", () => {
    const testCases = [
      null,
      undefined,
      123,
      [],
      true,
      "", // empty string
      "not json",
      "{invalid json}",
      JSON.stringify({ wrong: "type" }),
      { wrong: "type" },
    ];

    testCases.forEach((testCase) => {
      expect(parseWithTypeGuard(testCase, isTestType)).toBeNull();
    });
  });

  // Test with our actual types
  it("should work with UserOperation", () => {
    const validUserOp = {
      nonce: "0x0",
      sender: "0xf87f7247a8228021aD5f778554F583b683450463",
      callData:
        "0x7bb374280000000000000000000000000000000000000000000000000000000000000000",
      maxPriorityFeePerGas: "0xf4240",
      maxFeePerGas: "0xf4402",
      verificationGasLimit: "0x7bac9",
      callGasLimit: "0x1f02e",
      preVerificationGas: "0xeff88",
    };

    expect(parseWithTypeGuard(validUserOp, isUserOperation)).toStrictEqual(
      validUserOp
    );
    expect(
      parseWithTypeGuard(JSON.stringify(validUserOp), isUserOperation)
    ).toStrictEqual(validUserOp);
  });

  it("should work with EIP712TypedData", () => {
    const validTypedData = {
      domain: { chainId: 1, name: "Test" },
      types: { Test: [{ name: "value", type: "string" }] },
      message: { value: "test" },
      primaryType: "Test",
    };

    expect(parseWithTypeGuard(validTypedData, isEIP712TypedData)).toStrictEqual(
      validTypedData
    );
    expect(
      parseWithTypeGuard(JSON.stringify(validTypedData), isEIP712TypedData)
    ).toStrictEqual(validTypedData);
  });

  it("should parse complex SafeTx EIP712TypedData string", () => {
    // eslint-disable-next-line quotes
    const typedDataString = `{\"types\":{\"SafeTx\":[{\"name\":\"to\",\"type\":\"address\"},{\"name\":\"value\",\"type\":\"uint256\"},{\"name\":\"data\",\"type\":\"bytes\"},{\"name\":\"operation\",\"type\":\"uint8\"},{\"name\":\"safeTxGas\",\"type\":\"uint256\"},{\"name\":\"baseGas\",\"type\":\"uint256\"},{\"name\":\"gasPrice\",\"type\":\"uint256\"},{\"name\":\"gasToken\",\"type\":\"address\"},{\"name\":\"refundReceiver\",\"type\":\"address\"},{\"name\":\"nonce\",\"type\":\"uint256\"}],\"EIP712Domain\":[{\"name\":\"chainId\",\"type\":\"uint256\"},{\"name\":\"verifyingContract\",\"type\":\"address\"}]},\"domain\":{\"chainId\":\"0xaa36a7\",\"verifyingContract\":\"0x7fa8e8264985c7525fc50f98ac1a9b3765405489\"},\"primaryType\":\"SafeTx\",\"message\":{\"to\":\"0x102543f7e6b5786a444cc89ff73012825d13000d\",\"value\":\"100000000000000000\",\"data\":\"0x\",\"operation\":\"0\",\"safeTxGas\":\"0\",\"baseGas\":\"0\",\"gasPrice\":\"0\",\"gasToken\":\"0x0000000000000000000000000000000000000000\",\"refundReceiver\":\"0x0000000000000000000000000000000000000000\",\"nonce\":\"0\"}}`;

    const expectedParsedData = {
      types: {
        SafeTx: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "operation", type: "uint8" },
          { name: "safeTxGas", type: "uint256" },
          { name: "baseGas", type: "uint256" },
          { name: "gasPrice", type: "uint256" },
          { name: "gasToken", type: "address" },
          { name: "refundReceiver", type: "address" },
          { name: "nonce", type: "uint256" },
        ],
        EIP712Domain: [
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
      },
      domain: {
        chainId: "0xaa36a7",
        verifyingContract: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
      },
      primaryType: "SafeTx",
      message: {
        to: "0x102543f7e6b5786a444cc89ff73012825d13000d",
        value: "100000000000000000",
        data: "0x",
        operation: "0",
        safeTxGas: "0",
        baseGas: "0",
        gasPrice: "0",
        gasToken: "0x0000000000000000000000000000000000000000",
        refundReceiver: "0x0000000000000000000000000000000000000000",
        nonce: "0",
      },
    };

    // Test with parseWithTypeGuard
    expect(
      parseWithTypeGuard(typedDataString, isEIP712TypedData)
    ).toStrictEqual(expectedParsedData);

    // Test with dedicated parser
    expect(parseEip712TypedData(typedDataString)).toStrictEqual(
      expectedParsedData
    );
  });
});
