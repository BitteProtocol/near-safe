# Near-Safe

**TLDR;** This project provides a TypeScript implementation for controling Ethereum Smart Accounts via ERC4337 standard from a Near Account. 
It includes utilities for packing data, managing transactions, and interacting with a bundler.

The account structure is defined as follows:

1. **Near Account** produces signatures for a deterministic EOA via Near's MPC Contract for [Chain Signatures](https://docs.near.org/concepts/abstraction/chain-signatures)
2. This EOA (controled by the Near Account) is the owner of a deterministic [Safe](https://safe.global/) with configured support for [ERC4337](https://www.erc4337.io/) standard.

## Features

1. Users first transaction is bundled together with the Safe's deployement (i.e. Safe does not need to be created before it is used). This is achived as multisend transaction.
2. No need to fund the EOA Account (it is only used for signatures).
3. Account Recovery: Near's MPC service provides signatures for accounts that users control, but do not hold the private key for. Provide a "recoveryAddress" that will be added as an additional owner of the Safe.
4. Paymaster Support for an entirely gasless experience!
5. Same address on all chains!

## Installation & Configuration

To get started, clone the repository and install the dependencies:

```sh
yarn install
```

Create a `.env` (or use our `.env.sample`) file in the root of the project and add the following environment variables:

```sh
ETH_RPC=https://rpc2.sepolia.org

NEAR_ACCOUNT_ID=
NEAR_ACCOUNT_PRIVATE_KEY=

# Head to https://www.pimlico.io/ for an API key
ERC4337_BUNDLER_URL=
```


## Usage

### Running the Example

The example script `examples/send-tx.ts` demonstrates how to use the transaction manager. You can run it with the following command:

```sh
yarn start --usePaymaster --recoveryAddress <recovery_address> --safeSaltNonce <safe_salt_nonce>
```

### Example Arguments

The example script accepts the following arguments:

- `--usePaymaster`: Boolean flag to indicate if the transaction should be sponsored by a paymaster service.
- `--recoveryAddress`: The recovery address to be attached as the owner of the Safe (immediately after deployment).
- `--safeSaltNonce`: The salt nonce used for the Safe deployment.

