import { formatEvmData } from "../../../src/decode";

describe("explain", () => {
  describe("formatEvmData", () => {
    it("formats decoded EVM data with BigInt values", async () => {
      const decodedData = {
        chainId: 11155111, // Sepolia
        costEstimate: "0.01",
        transactions: [
          {
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000000000000000", // 1 ETH
            data: "0x",
            operation: 0,
          },
        ],
        message: "Test transaction",
      };

      const functionSigs = [
        {
          method: "transfer",
          parameters: [
            {
              name: "to",
              type: "address",
              value: "0x1234567890123456789012345678901234567890",
            },
            {
              name: "value",
              type: "uint256",
              value: "1000000000000000000",
            },
          ],
        },
      ];

      const expected = {
        chainId: 11155111,
        costEstimate: "0.01",
        transactions: [
          {
            to: "0x1234567890123456789012345678901234567890",
            value: "1000000000000000000",
            data: "0x",
            operation: 0,
          },
        ],
        message: "Test transaction",
        network: "Sepolia",
        functionSignatures: functionSigs,
      };

      const result = await formatEvmData(decodedData, functionSigs);
      expect(JSON.parse(result)).toEqual(expected);
    });

    it("preserves non-BigInt values", () => {
      const decodedData = {
        chainId: 137, // Polygon
        costEstimate: "0.01",
        transactions: [
          {
            to: "0x1234567890123456789012345678901234567890",
            value: "0x00",
            data: "0x",
            operation: 0,
            extra: {
              string: "test",
              number: 123,
              boolean: true,
              null: null,
              array: [1, 2, 3],
              nested: {
                value: "nested",
              },
            },
          },
        ],
      };

      const result = JSON.parse(formatEvmData(decodedData, []));

      expect(result.transactions[0].extra).toEqual({
        string: "test",
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: {
          value: "nested",
        },
      });
    });
  });
});
