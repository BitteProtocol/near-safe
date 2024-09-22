// Auto-generated file from build script
import { SafeDeployments } from "../types";

export const SAFE_DEPLOYMENTS: SafeDeployments = {
  singleton: {
    address: "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "AddedOwner",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "approvedHash",
            type: "bytes32",
          },
          {
            indexed: true,
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "ApproveHash",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "handler",
            type: "address",
          },
        ],
        name: "ChangedFallbackHandler",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "guard",
            type: "address",
          },
        ],
        name: "ChangedGuard",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "uint256",
            name: "threshold",
            type: "uint256",
          },
        ],
        name: "ChangedThreshold",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "DisabledModule",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "EnabledModule",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "txHash",
            type: "bytes32",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "payment",
            type: "uint256",
          },
        ],
        name: "ExecutionFailure",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "ExecutionFromModuleFailure",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "ExecutionFromModuleSuccess",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "txHash",
            type: "bytes32",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "payment",
            type: "uint256",
          },
        ],
        name: "ExecutionSuccess",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "RemovedOwner",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "address",
            name: "module",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            indexed: false,
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
        ],
        name: "SafeModuleTransaction",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: false,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            indexed: false,
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "safeTxGas",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "baseGas",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "gasPrice",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "address",
            name: "gasToken",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address payable",
            name: "refundReceiver",
            type: "address",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "signatures",
            type: "bytes",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "additionalInfo",
            type: "bytes",
          },
        ],
        name: "SafeMultiSigTransaction",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "sender",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        name: "SafeReceived",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "initiator",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address[]",
            name: "owners",
            type: "address[]",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "threshold",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "address",
            name: "initializer",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "fallbackHandler",
            type: "address",
          },
        ],
        name: "SafeSetup",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "msgHash",
            type: "bytes32",
          },
        ],
        name: "SignMsg",
        type: "event",
      },
      {
        stateMutability: "nonpayable",
        type: "fallback",
      },
      {
        inputs: [],
        name: "VERSION",
        outputs: [
          {
            internalType: "string",
            name: "",
            type: "string",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "_threshold",
            type: "uint256",
          },
        ],
        name: "addOwnerWithThreshold",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "hashToApprove",
            type: "bytes32",
          },
        ],
        name: "approveHash",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        name: "approvedHashes",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "_threshold",
            type: "uint256",
          },
        ],
        name: "changeThreshold",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "dataHash",
            type: "bytes32",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "signatures",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "requiredSignatures",
            type: "uint256",
          },
        ],
        name: "checkNSignatures",
        outputs: [],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "dataHash",
            type: "bytes32",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "signatures",
            type: "bytes",
          },
        ],
        name: "checkSignatures",
        outputs: [],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "prevModule",
            type: "address",
          },
          {
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "disableModule",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "domainSeparator",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "enableModule",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "safeTxGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "baseGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "gasPrice",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "gasToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "refundReceiver",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "_nonce",
            type: "uint256",
          },
        ],
        name: "encodeTransactionData",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "safeTxGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "baseGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "gasPrice",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "gasToken",
            type: "address",
          },
          {
            internalType: "address payable",
            name: "refundReceiver",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "signatures",
            type: "bytes",
          },
        ],
        name: "execTransaction",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "payable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
        ],
        name: "execTransactionFromModule",
        outputs: [
          {
            internalType: "bool",
            name: "success",
            type: "bool",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
        ],
        name: "execTransactionFromModuleReturnData",
        outputs: [
          {
            internalType: "bool",
            name: "success",
            type: "bool",
          },
          {
            internalType: "bytes",
            name: "returnData",
            type: "bytes",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "getChainId",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "start",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "pageSize",
            type: "uint256",
          },
        ],
        name: "getModulesPaginated",
        outputs: [
          {
            internalType: "address[]",
            name: "array",
            type: "address[]",
          },
          {
            internalType: "address",
            name: "next",
            type: "address",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "getOwners",
        outputs: [
          {
            internalType: "address[]",
            name: "",
            type: "address[]",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "uint256",
            name: "offset",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "length",
            type: "uint256",
          },
        ],
        name: "getStorageAt",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "getThreshold",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "enum Enum.Operation",
            name: "operation",
            type: "uint8",
          },
          {
            internalType: "uint256",
            name: "safeTxGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "baseGas",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "gasPrice",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "gasToken",
            type: "address",
          },
          {
            internalType: "address",
            name: "refundReceiver",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "_nonce",
            type: "uint256",
          },
        ],
        name: "getTransactionHash",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "module",
            type: "address",
          },
        ],
        name: "isModuleEnabled",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "isOwner",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "nonce",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "prevOwner",
            type: "address",
          },
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "_threshold",
            type: "uint256",
          },
        ],
        name: "removeOwner",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "handler",
            type: "address",
          },
        ],
        name: "setFallbackHandler",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "guard",
            type: "address",
          },
        ],
        name: "setGuard",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address[]",
            name: "_owners",
            type: "address[]",
          },
          {
            internalType: "uint256",
            name: "_threshold",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "address",
            name: "fallbackHandler",
            type: "address",
          },
          {
            internalType: "address",
            name: "paymentToken",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "payment",
            type: "uint256",
          },
          {
            internalType: "address payable",
            name: "paymentReceiver",
            type: "address",
          },
        ],
        name: "setup",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        name: "signedMessages",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "targetContract",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "calldataPayload",
            type: "bytes",
          },
        ],
        name: "simulateAndRevert",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "prevOwner",
            type: "address",
          },
          {
            internalType: "address",
            name: "oldOwner",
            type: "address",
          },
          {
            internalType: "address",
            name: "newOwner",
            type: "address",
          },
        ],
        name: "swapOwner",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        stateMutability: "payable",
        type: "receive",
      },
    ],
  },
  proxyFactory: {
    address: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67",
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "contract SafeProxy",
            name: "proxy",
            type: "address",
          },
          {
            indexed: false,
            internalType: "address",
            name: "singleton",
            type: "address",
          },
        ],
        name: "ProxyCreation",
        type: "event",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "_singleton",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "initializer",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "saltNonce",
            type: "uint256",
          },
        ],
        name: "createChainSpecificProxyWithNonce",
        outputs: [
          {
            internalType: "contract SafeProxy",
            name: "proxy",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "_singleton",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "initializer",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "saltNonce",
            type: "uint256",
          },
          {
            internalType: "contract IProxyCreationCallback",
            name: "callback",
            type: "address",
          },
        ],
        name: "createProxyWithCallback",
        outputs: [
          {
            internalType: "contract SafeProxy",
            name: "proxy",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "_singleton",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "initializer",
            type: "bytes",
          },
          {
            internalType: "uint256",
            name: "saltNonce",
            type: "uint256",
          },
        ],
        name: "createProxyWithNonce",
        outputs: [
          {
            internalType: "contract SafeProxy",
            name: "proxy",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "getChainId",
        outputs: [
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "proxyCreationCode",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        stateMutability: "pure",
        type: "function",
      },
    ],
  },
  moduleSetup: {
    address: "0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47",
    abi: [
      {
        inputs: [
          {
            internalType: "address[]",
            name: "modules",
            type: "address[]",
          },
        ],
        name: "enableModules",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
  },
  m4337: {
    address: "0x75cf11467937ce3F2f357CE24ffc3DBF8fD5c226",
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "entryPoint",
            type: "address",
          },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        inputs: [],
        name: "ExecutionFailed",
        type: "error",
      },
      {
        inputs: [],
        name: "InvalidCaller",
        type: "error",
      },
      {
        inputs: [],
        name: "InvalidEntryPoint",
        type: "error",
      },
      {
        inputs: [],
        name: "UnsupportedEntryPoint",
        type: "error",
      },
      {
        inputs: [
          {
            internalType: "bytes4",
            name: "selector",
            type: "bytes4",
          },
        ],
        name: "UnsupportedExecutionFunction",
        type: "error",
      },
      {
        inputs: [],
        name: "SUPPORTED_ENTRYPOINT",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "domainSeparator",
        outputs: [
          {
            internalType: "bytes32",
            name: "domainSeparatorHash",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "contract Safe",
            name: "safe",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "message",
            type: "bytes",
          },
        ],
        name: "encodeMessageDataForSafe",
        outputs: [
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "uint8",
            name: "operation",
            type: "uint8",
          },
        ],
        name: "executeUserOp",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
          {
            internalType: "uint8",
            name: "operation",
            type: "uint8",
          },
        ],
        name: "executeUserOpWithErrorString",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes",
            name: "message",
            type: "bytes",
          },
        ],
        name: "getMessageHash",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "contract Safe",
            name: "safe",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "message",
            type: "bytes",
          },
        ],
        name: "getMessageHashForSafe",
        outputs: [
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "getModules",
        outputs: [
          {
            internalType: "address[]",
            name: "",
            type: "address[]",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "sender",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "bytes",
                name: "initCode",
                type: "bytes",
              },
              {
                internalType: "bytes",
                name: "callData",
                type: "bytes",
              },
              {
                internalType: "bytes32",
                name: "accountGasLimits",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "preVerificationGas",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "gasFees",
                type: "bytes32",
              },
              {
                internalType: "bytes",
                name: "paymasterAndData",
                type: "bytes",
              },
              {
                internalType: "bytes",
                name: "signature",
                type: "bytes",
              },
            ],
            internalType: "struct PackedUserOperation",
            name: "userOp",
            type: "tuple",
          },
        ],
        name: "getOperationHash",
        outputs: [
          {
            internalType: "bytes32",
            name: "operationHash",
            type: "bytes32",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes32",
            name: "_dataHash",
            type: "bytes32",
          },
          {
            internalType: "bytes",
            name: "_signature",
            type: "bytes",
          },
        ],
        name: "isValidSignature",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes",
            name: "_data",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "_signature",
            type: "bytes",
          },
        ],
        name: "isValidSignature",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "uint256[]",
            name: "",
            type: "uint256[]",
          },
          {
            internalType: "uint256[]",
            name: "",
            type: "uint256[]",
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        name: "onERC1155BatchReceived",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "pure",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        name: "onERC1155Received",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "pure",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        name: "onERC721Received",
        outputs: [
          {
            internalType: "bytes4",
            name: "",
            type: "bytes4",
          },
        ],
        stateMutability: "pure",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "targetContract",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "calldataPayload",
            type: "bytes",
          },
        ],
        name: "simulate",
        outputs: [
          {
            internalType: "bytes",
            name: "response",
            type: "bytes",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "bytes4",
            name: "interfaceId",
            type: "bytes4",
          },
        ],
        name: "supportsInterface",
        outputs: [
          {
            internalType: "bool",
            name: "",
            type: "bool",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "address",
            name: "",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "",
            type: "uint256",
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "",
            type: "bytes",
          },
        ],
        name: "tokensReceived",
        outputs: [],
        stateMutability: "pure",
        type: "function",
      },
      {
        inputs: [
          {
            components: [
              {
                internalType: "address",
                name: "sender",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "nonce",
                type: "uint256",
              },
              {
                internalType: "bytes",
                name: "initCode",
                type: "bytes",
              },
              {
                internalType: "bytes",
                name: "callData",
                type: "bytes",
              },
              {
                internalType: "bytes32",
                name: "accountGasLimits",
                type: "bytes32",
              },
              {
                internalType: "uint256",
                name: "preVerificationGas",
                type: "uint256",
              },
              {
                internalType: "bytes32",
                name: "gasFees",
                type: "bytes32",
              },
              {
                internalType: "bytes",
                name: "paymasterAndData",
                type: "bytes",
              },
              {
                internalType: "bytes",
                name: "signature",
                type: "bytes",
              },
            ],
            internalType: "struct PackedUserOperation",
            name: "userOp",
            type: "tuple",
          },
          {
            internalType: "bytes32",
            name: "",
            type: "bytes32",
          },
          {
            internalType: "uint256",
            name: "missingAccountFunds",
            type: "uint256",
          },
        ],
        name: "validateUserOp",
        outputs: [
          {
            internalType: "uint256",
            name: "validationData",
            type: "uint256",
          },
        ],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
  },
  entryPoint: {
    address: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    abi: [
      {
        name: "getNonce",
        type: "function",
        stateMutability: "view",
        inputs: [
          {
            type: "address",
          },
          {
            type: "uint192",
            name: "key",
          },
        ],
        outputs: [
          {
            type: "uint256",
            name: "nonce",
          },
        ],
      },
    ],
  },
};
