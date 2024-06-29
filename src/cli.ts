import yargs from "yargs";
import { hideBin } from "yargs/helpers";

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
    }).argv;
}
