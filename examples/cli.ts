import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { DEFAULT_SAFE_SALT_NONCE, UserOptions } from "../src";

interface ScriptEnv {
  nearAccountId: string;
  nearAccountPrivateKey?: string;
  pimlicoKey: string;
}

export async function loadEnv(): Promise<ScriptEnv> {
  const { NEAR_ACCOUNT_ID, NEAR_ACCOUNT_PRIVATE_KEY, PIMLICO_KEY } =
    process.env;
  if (!NEAR_ACCOUNT_ID) {
    throw new Error("Must provide env var NEAR_ACCOUNT_ID");
  }
  if (!PIMLICO_KEY) {
    throw new Error("Must provide env var PIMLICO_KEY");
  }

  return {
    nearAccountId: NEAR_ACCOUNT_ID,
    nearAccountPrivateKey: NEAR_ACCOUNT_PRIVATE_KEY,
    pimlicoKey: PIMLICO_KEY,
  };
}

export async function loadArgs(): Promise<UserOptions> {
  return yargs(hideBin(process.argv))
    .option("sponsorshipPolicy", {
      type: "string",
      description: "Have transaction sponsored by paymaster service",
    })
    .option("recoveryAddress", {
      type: "string",
      description:
        "Recovery address to be attached as owner of the Safe (immediately adter deployment)",
    })
    .option("safeSaltNonce", {
      type: "string",
      description: "Salt nonce used for the Safe deployment",
      default: DEFAULT_SAFE_SALT_NONCE,
    })
    .option("mpcContractId", {
      type: "string",
      description: "Address of the mpc (signing) contract",
      default: "v1.signer-prod.testnet",
    })
    .help()
    .alias("help", "h").argv;
}
