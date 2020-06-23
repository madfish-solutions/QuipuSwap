type vote_info is record
  allowances: map(address, bool);
  candidate: option(key_hash);
end

type dex_storage is record 
  feeRate: nat;
  tezPool: nat;
  tokenPool: nat;
  invariant: nat;
  totalShares: nat;
  tokenAddress: address;
  factoryAddress: address;
  shares: big_map(address, nat);
  voters: big_map(address, vote_info);
  vetos: big_map(key_hash, timestamp);
  vetoVoters: big_map(address, nat);
  votes: big_map(key_hash, nat);
  veto: nat;
  total_votes: nat;
  reward: tez;
  next_circle: timestamp;
  current_circle: nat;
  circles: map(nat, tez);
  current_delegated : key_hash;
  receive_reward : address;
  delegated: key_hash;
  nextDelegated: key_hash;
  allowed: big_map(address, bool);
end

type dexAction is
| UpdateStorage of (dex_storage)
| RequestTransfer of (address * nat * bool)
| RequestOperation of (option(key_hash))
| Lookup of (address * address * nat * nat)
| GetStorage
| Default