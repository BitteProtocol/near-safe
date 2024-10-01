import dotenv from "dotenv";

import { NearSafe } from "../src";

dotenv.config();
describe("Near Safe Requests", () => {
  it("buildTransaction", async () => {
    const adapter = await NearSafe.create({
      accountId: "neareth-dev.testnet",
      mpcContractId: "v1.signer-prod.testnet",
      pimlicoKey: process.env.PIMLICO_KEY!,
    });
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
        usePaymaster: true,
      })
    ).resolves.not.toThrow();
    // Can't send raw messages to Safe Contracts.
    await expect(
      adapter.buildTransaction({
        chainId: 11155111,
        transactions: [
          {
            to: adapter.address,
            ...irrelevantData,
          },
        ],
        usePaymaster: true,
      })
    ).rejects.toThrow();
  });
});
