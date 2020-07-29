type vote_info is record
  allowances: set(address);
  candidate: option(key_hash);
end

type user_circle_info is record
  reward: nat;
  loyalty: nat;
  lastCircle: nat;
  lastCircleUpdate: timestamp;
end

type circle_info is record
  reward: nat;
  counter: nat;
  start: timestamp;
  lastUpdate: timestamp;
  totalLoyalty: nat;
  nextCircle: timestamp;
  circleCoefficient: nat;
end

type dex_storage is record 
  feeRate: nat;
  tezPool: nat;
  tokenPool: nat;
  invariant: nat;
  totalShares: nat;
  tokenAddress: address;
  tokenId: nat;
  factoryAddress: address;
  shares: big_map(address, nat);
  voters: big_map(address, vote_info);
  vetos: big_map(key_hash, timestamp);
  vetoVoters: big_map(address, nat);
  votes: big_map(key_hash, nat);
  veto: nat;
  delegated: option(key_hash);
  currentDelegated : option(key_hash);
  totalVotes: nat;
  currentCircle: circle_info;
  circles: big_map(nat, circle_info);
  circleLoyalty: big_map(address, user_circle_info);
end

type tezToTokenPaymentArgs is record 
  amount : nat; 
  receiver : address; 
end
type tokenToTezPaymentArgs is record 
  amount : nat; 
  minOut : nat; 
  receiver : address;
end

type divestLiquidityArgs is record 
  minTez : nat; 
  minTokens : nat;
  shares : nat; 
end

type setVotesDelegationArgs is record 
  account : address;
  isAllowed : bool;
end

type voteArgs is record 
  candidate : key_hash;
  voter : address; 
end

type dexAction is
| InitializeExchange of (nat)
| TezToTokenPayment of tezToTokenPaymentArgs
| TokenToTezPayment of tokenToTezPaymentArgs
| InvestLiquidity of (nat)
| DivestLiquidity of divestLiquidityArgs
| SetVotesDelegation of setVotesDelegationArgs
| Vote of voteArgs
| Veto of (address)
| WithdrawProfit of (address)

type fullAction is
| Use of (nat * dexAction)
| Default of unit

type full_dex_storage is record
  storage: dex_storage;
  lambdas: big_map(nat, (dexAction * dex_storage * address) -> (list(operation) * dex_storage));
end