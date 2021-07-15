const standard = process.env.EXCHANGE_TOKEN_STANDARD;
const usedStandard = standard == "MIXED" ? "FA2" : standard;
const TTDex = artifacts.require("TTDex");
const MetadataStorage = artifacts.require("MetadataStorage");
const dexStorage = require("../storage/TTDex");
const { TezosToolkit } = require("@taquito/taquito");
const { InMemorySigner } = require("@taquito/signer");
const { MichelsonMap } = require("@taquito/michelson-encoder");
const { dexFunctions, tokenFunctions } = require("../storage/TTFunctions");
const { execSync } = require("child_process");
const Token = artifacts.require("Token" + usedStandard);
const TokenFA12 = artifacts.require("TokenFA12");
const TokenFA2 = artifacts.require("TokenFA2");
const tokenStorage = require("../storage/Token" + usedStandard);
const tokenFA12Storage = require("../storage/TokenFA12");
const tokenFA2Storage = require("../storage/TokenFA2");
const { getLigo } = require("../scripts/utils");
const accountsStored = require("../scripts/sandbox/accounts");

const initialTezAmount = 1;
const initialTokenAmount = 1000000;
const defaultTokenId = 0;

module.exports = async (deployer, network, accounts) => {
  tezos = new TezosToolkit(tezos.rpc.url);
  if (network === "development") return;
  const secretKey = accountsStored.alice.sk.trim();
  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: 500,
    },
    signer: await InMemorySigner.fromSecretKey(secretKey),
  });

  const metadataStorageInstance = await MetadataStorage.deployed();
  dexStorage.metadata = MichelsonMap.fromLiteral({
    "": Buffer(
      "tezos-storage://" +
        metadataStorageInstance.address.toString() +
        "/quipu",
      "ascii"
    ).toString("hex"),
  });
  await deployer.deploy(TTDex, dexStorage);
  const dexInstance = await TTDex.deployed();
  console.log(`TTDex address: ${dexInstance.address}`);

  const ligo = getLigo(true);

  for (dexFunction of dexFunctions) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/TTDex.ligo main 'SetDexFunction(record index =${dexFunction.index}n; func = ${dexFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: dexInstance.address,
      amount: 0,
      parameter: {
        entrypoint: "setDexFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0],
      },
    });
    await operation.confirmation();
  }
  for (tokenFunction of tokenFunctions[standard]) {
    const stdout = execSync(
      `${ligo} compile-parameter --michelson-format=json $PWD/contracts/main/TTDex.ligo main 'SetTokenFunction(record index =${tokenFunction.index}n; func = ${tokenFunction.name}; end)'`,
      { maxBuffer: 1024 * 500 }
    );
    const operation = await tezos.contract.transfer({
      to: dexInstance.address,
      amount: 0,
      parameter: {
        entrypoint: "setTokenFunction",
        value: JSON.parse(stdout.toString()).args[0].args[0].args[0],
      },
    });
    await operation.confirmation();
  }

  if (network !== "mainnet") {
    let token0Instance = await tezos.contract.at(
      standard == "MIXED"
        ? (await TokenFA2.new(tokenFA2Storage)).address.toString()
        : (await Token.new(tokenStorage)).address.toString()
    );
    let token1Instance = await tezos.contract.at(
      standard == "MIXED"
        ? (await TokenFA12.new(tokenFA12Storage)).address.toString()
        : (await Token.new(tokenStorage)).address.toString()
    );
    console.log(`Token 1 address: ${token0Instance.address}`);
    console.log(`Token 2 address: ${token1Instance.address}`);

    const dex = await tezos.contract.at(dexInstance.address.toString());
    const ordered =
      token0Instance.address.toString() < token1Instance.address.toString();
    if (standard === "FA12") {
      let operation = await token0Instance.methods
        .approve(dexInstance.address.toString(), initialTokenAmount)
        .send();
      await operation.confirmation();
      operation = await token1Instance.methods
        .approve(dexInstance.address.toString(), initialTokenAmount)
        .send();
      await operation.confirmation();
    } else {
      let operation = await token0Instance.methods
        .update_operators([
          {
            add_operator: {
              owner: accounts[0],
              operator: dexInstance.address.toString(),
              token_id: defaultTokenId,
            },
          },
        ])
        .send();
      await operation.confirmation();
      if (standard == "MIXED") {
        operation = await token1Instance.methods
          .approve(dexInstance.address.toString(), initialTokenAmount)
          .send();
      } else {
        operation = await token1Instance.methods
          .update_operators([
            {
              add_operator: {
                owner: accounts[0],
                operator: dexInstance.address.toString(),
                token_id: defaultTokenId,
              },
            },
          ])
          .send();
      }
      await operation.confirmation();
    }
    operation = await dex.methods
      .use(
        "addPair",
        ordered
          ? token0Instance.address.toString()
          : token1Instance.address.toString(),
        0,
        standard == "MIXED" ? "fa2" : standard.toLocaleLowerCase(),
        null,
        ordered
          ? token1Instance.address.toString()
          : token0Instance.address.toString(),
        0,
        standard == "MIXED" ? "fa12" : standard.toLocaleLowerCase(),
        null,
        initialTokenAmount,
        initialTokenAmount
      )
      .send();

    await operation.confirmation();
  }
};
