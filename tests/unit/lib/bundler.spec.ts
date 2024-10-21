import { Erc4337Bundler, stripApiKey } from "../../../src/lib/bundler";

describe("Safe Pack", () => {
  const entryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
  it("Unauthorized Requests Failure", async () => {
    const unauthorizedBundler = new Erc4337Bundler(
      entryPoint,
      "invalid API key",
      11155111
    );
    await expect(() => unauthorizedBundler.getGasPrice()).rejects.toThrow(
      "Unauthorized request. Please check your Pimlico API key."
    );
  });

  it("Strips API Key from error message", () => {
    const apiKey = "any-thirty-six-character-long-string";
    const message = (x: string): string => `Unexpected Error
    URL: https://api.pimlico.io/v2/11155111/rpc?apikey=${x}
    Request body: {"method":"pm_sponsorUserOperation",{"sponsorshipPolicyId":"sp_clear_vampiro"}]}`;
    expect(stripApiKey(new Error(message(apiKey)))).toEqual(message("***"));

    expect(stripApiKey(new Error(message("TopSecret")))).toEqual(
      message("***")
    );
  });
});
