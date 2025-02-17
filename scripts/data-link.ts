import { DuneClient } from "@duneanalytics/client-sdk";
import dotenv from "dotenv";

import { NearSafe } from "../src";

interface Pairing {
  near: string;
  mpc: string;
  safe: string;
}

export async function accountPairings(data: {
  nearAddress: string;
  keyVersion: number;
  derivationPath: string;
  safeSaltNonce: string;
}): Promise<Pairing> {
  const { nearAddress, keyVersion, derivationPath, safeSaltNonce } = data;
  if (keyVersion !== 0) {
    throw new Error("Only key version 0 is supported");
  }
  const adapter = await NearSafe.create({
    mpc: {
      accountId: nearAddress,
      mpcContractId: "v1.signer",
      derivationPath,
    },
    pimlicoKey: "",
    safeSaltNonce,
  });
  return {
    near: nearAddress,
    mpc: adapter.mpcAddress,
    safe: adapter.address,
  };
}

interface SignerUser {
  sign_for: string;
  key_version: number;
  derivation_path: string;
  num_relayed: number;
  total: number;
}

// Example usage
export async function getAllSignerUsers(
  dune: DuneClient
): Promise<SignerUser[]> {
  // This Dune Query is better than near blocks:
  // https://dune.com/queries/4611467
  const queryId = 4611467;
  const { result } = await dune.getLatestResult({ queryId });
  const data: SignerUser[] = (result?.rows ?? []).map((row) => ({
    sign_for: String(row.sign_for),
    key_version: Number(row.key_version),
    derivation_path: String(row.derivation_path),
    num_relayed: Number(row.num_relayed),
    total: Number(row.total),
  }));
  return data;
}

export async function generateCSV(dune: DuneClient): Promise<string> {
  const data = await getAllSignerUsers(dune);
  const BITTE_WALLET_SALT_NONCE = "130811896738364156958237239906781888512";
  const pairings = await Promise.all(
    data
      .filter((user) => user.derivation_path === "ethereum,1")
      .map((user) =>
        accountPairings({
          nearAddress: user.sign_for,
          keyVersion: user.key_version,
          derivationPath: user.derivation_path,
          safeSaltNonce: BITTE_WALLET_SALT_NONCE,
        })
      )
  );

  const csvContent = pairings
    .map((pairing) => `${pairing.near},${pairing.mpc},${pairing.safe}`)
    .join("\n");

  // fs.writeFileSync("wallet-pairings.csv", "near,mpc,safe\n" + csvContent);
  return csvContent;
}

export async function duneUpload(): Promise<void> {
  dotenv.config();
  const dune = new DuneClient(process.env.DUNE_API_KEY ?? "");
  const csv = await generateCSV(dune);
  // fs.writeFileSync("wallet-pairings.csv", "near,mpc,safe\n" + csv);
  const result = await dune.table.uploadCsv({
    table_name: "neareth_pairings",
    data: "near,mpc,safe\n" + csv,
    description: "Near -> MPC -> Safe Tuples",
    is_private: false,
  });
  console.log(result);
}

duneUpload().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
