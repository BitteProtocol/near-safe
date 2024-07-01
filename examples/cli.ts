import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { UserOptions } from "../src";

export async function loadArgs(): Promise<UserOptions> {
  return yargs(hideBin(process.argv))
    .option("usePaymaster", {
      type: "boolean",
      description: "Have transaction sponsored by paymaster service",
      default: false,
    })
    .option("recoveryAddress", {
      type: "string",
      description:
        "Recovery address to be attached as owner of the Safe (immediately adter deployment)",
      default: undefined,
    })
    .option("safeSaltNonce", {
      type: "string",
      description: "Salt nonce used for the Safe deployment",
      default: "0",
    })
    .help()
    .alias("help", "h").argv;
}
