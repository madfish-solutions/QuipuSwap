(* Perform transfers from one owner *)
[@inline] function iterate_transfer (const s : dex_storage; const user_trx_params : transfer_param) : dex_storage is
  block {
    (* Perform single transfer *)
    function make_transfer(const s : dex_storage; const transfer : transfer_destination) : dex_storage is
      block {
        (* Retrieve sender account from storage *)
        const user_key : (address * nat) = (user_trx_params.from_, transfer.token_id);
        const sender_account : account_info = get_account(user_key, s);

        (* Check permissions *)
        if user_trx_params.from_ = Tezos.sender or sender_account.allowances contains Tezos.sender then
          skip
        else failwith("FA2_NOT_OPERATOR");

        (* Balance check *)
        if sender_account.balance < transfer.amount then
          failwith("FA2_INSUFFICIENT_BALANCE")
        else skip;

        (* Update sender balance *)
        sender_account.balance := abs(sender_account.balance - transfer.amount);

        (* Update storage *)
        s.ledger[user_key] := sender_account;

        (* Create or get destination account *)
        var dest_account : account_info := get_account((transfer.to_, transfer.token_id), s);

        (* Update destination balance *)
        dest_account.balance := dest_account.balance + transfer.amount;

        (* Update storage *)
        s.ledger[(transfer.to_, transfer.token_id)] := dest_account;
    } with s;
} with (List.fold (make_transfer, user_trx_params.txs, s))

(* Perform single operator update *)
function iterate_update_operator (const s : dex_storage; const params : update_operator_param) : dex_storage is
  block {
    case params of
    | Add_operator(param) -> {
      (* Check an owner *)
      if Tezos.sender =/= param.owner then
        failwith("FA2_NOT_OWNER")
      else skip;

      (* Create or get sender account *)
      var sender_account : account_info := get_account((param.owner, param.token_id), s);

      (* Set operator *)
      sender_account.allowances := Set.add(param.operator, sender_account.allowances);

      (* Update storage *)
      s.ledger[(param.owner, param.token_id)] := sender_account;
    }
    | Remove_operator(param) -> {
      (* Check an owner *)
      if Tezos.sender =/= param.owner then
        failwith("FA2_NOT_OWNER")
      else skip;

      (* Create or get sender account *)
      var sender_account : account_info := get_account((param.owner, param.token_id), s);

      (* Set operator *)
      sender_account.allowances := Set.remove(param.operator, sender_account.allowances);

      (* Update storage *)
      s.ledger[(param.owner, param.token_id)] := sender_account;
    }
    end
  } with s


function transfer (const p : token_action; var s : dex_storage; const this : address) : return is
  block {
    var operations: list(operation) := list[];
    case p of
    | ITransfer(params) -> {
      s := List.fold(iterate_transfer, params, s);
    }
    | IBalance_of(_) -> skip
    | IUpdate_operators(_) -> skip
    end
  } with (operations, s)

function get_balance_of (const p : token_action; const s : dex_storage; const this : address) : return is
  block {
    var operations: list(operation) := list[];
    case p of
    | ITransfer(_) -> skip
    | IBalance_of(balance_params) -> {
      (* Perform single balance lookup *)
      function look_up_balance(const l: list (balance_of_response); const request : balance_of_request) : list (balance_of_response) is
        block {
          (* Retrieve the asked account balance from storage *)
          const sender_account : account_info = get_account((request.owner, request.token_id), s);

          (* Form the response *)
          const response : balance_of_response = record [
            request   = request;
            balance   = sender_account.balance;
          ];
        } with response # l;

      (* Collect balances info *)
      const accumulated_response : list (balance_of_response) = List.fold(look_up_balance, balance_params.requests, (nil: list(balance_of_response)));
      operations := list[Tezos.transaction(accumulated_response, 0mutez, balance_params.callback)];
    }
    | IUpdate_operators(_) -> skip
    end
  } with (operations, s)

function update_operators (const p : token_action; const s : dex_storage; const this : address) : return is
  block {
    var operations: list(operation) := list[];
    case p of
    | ITransfer(params) -> skip
    | IBalance_of(params) -> skip
    | IUpdate_operators(params) -> {
      s := List.fold(iterate_update_operator, params, s);
    }
    end
  } with (operations, s)