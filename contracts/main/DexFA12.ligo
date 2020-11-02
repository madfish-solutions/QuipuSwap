#include "../partials/Dex.ligo"

function main (const p : full_action; const s : full_dex_storage) : full_return is
  block {
     const this: address = Tezos.self_address; 
  } with case p of
      | Default -> use_default(s) 
      | Use(params) -> middle_dex(params.1, this, params.0, s) 
      | Transfer(params) -> middle_token(ITransfer(params), 0n, s)
      | Approve(params) -> middle_token(IApprove(params), 1n, s)
      | GetBalance(params) -> middle_token(IGetBalance(params), 2n, s)
      | GetAllowance(params) -> middle_token(IGetAllowance(params), 3n, s)
      | GetTotalSupply(params) -> middle_token(IGetTotalSupply(params), 4n, s)
    end