## Test cases

## General Requirements:

1. Initialization is only possible during deployment or if there is no shares.
2. The assets amount cannot be zero during initialization.
3. The user receives 1000 shares.
4. Each token can have the only pair.
5. Info about previous rewards (if any) should be reset.
6. The tokens should be withdrawn from user.

### Test Item: InitializeExchange Entrypoint

Scope: Test various ways to initialize the contract.
Action: Invoke the InitializeExchange entrypoint.
Test Notes and Preconditions: Ensure all the initialize approaches work.
Verification Steps: Verify the exchange is initialized and the initial state is correct.

Scenario 1: Test initialize during the deployment when

- [x] the pair doesn't exist
- [x] the amount of XTZ is zero
- [x] the amount of token is zero
- [x] the token isn't approved
- [x] the pair exists

Scenario 2: Test initialize after liquidity withdrawn when

- [x] liquidity is zero
- [x] liquidity isn't zero
- [x] the amount of XTZ is zero
- [x] the amount of token is zero
- [x] the token isn't approved

### Test Item: InvestLiquidity Entrypoint

## General Requirements:

1. Investment is only possible after initialization.
2. At least 1 share should be purchased.
3. Minimal shares are specified by the user.
4. The rewards for the previous period if any should be distributed.
5. The rewards to the user if any should be distributed.
6. The rewards should be withdrawn.
7. Prices are calculated as :

```
shares_purchased = xtz_amount * total_supply / tez_pool
tokens_amount = shares_purchased * token_pool / total_supply
```

Scope: Test if the investment is allowed.
Action: Invoke the InvestLiquidity entrypoint.
Test Notes and Preconditions: Ensure the investment is only possible after initialization.
Verification Steps: Verify the investment fails if the pool isn't launched.

Scenario 1: Test the investment

- [ ] with provided liquidity
- [ ] without provided liquidity

Scope: Test various min shared.
Action: Invoke the InvestLiquidity entrypoint.
Test Notes and Preconditions: The exchange should be launched before.
Verification Steps: Verify the investment fails if the the min shares are in the range.

Scenario 1: Test the investment with minimal shares of

- [ ] 0
- [ ] 1
- [ ] enough
- [ ] exact
- [ ] too many