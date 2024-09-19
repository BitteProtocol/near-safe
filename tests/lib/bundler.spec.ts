import { Erc4337Bundler } from "../../src/lib/bundler";
describe("Safe Pack", () => {
  const entryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

  it("Unauthorized Requests Failure", async () => {
    const unauthorizedBundler = new Erc4337Bundler(
      entryPoint,
      "invalidAPI key",
      11155111
    );
    await expect(() => unauthorizedBundler.getGasPrice()).rejects.toThrow(
      "Unauthorized request. Please check your API key."
    );
  });
});
