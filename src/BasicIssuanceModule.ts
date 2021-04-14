import {
  BalanceSheet,
  SetToken as SetTokenEntity,
  StandardToken,
} from "../generated/schema";
import { SetToken as SetTokenContract } from "../generated/SetToken/SetToken";

import {
  SetTokenIssued,
  SetTokenRedeemed,
} from "../generated/BasicIssuanceModule/BasicIssuanceModule";

import { Address, log, BigInt } from "@graphprotocol/graph-ts";

export function handleSetTokenIssued(event: SetTokenIssued): void {
  checkForTokensAndItsComponents(event.params._setToken);

  let id =
    event.params._to.toHexString() + "-" + event.params._setToken.toHexString();

  let balanceEntry = BalanceSheet.load(id);
  if (!balanceEntry) {
    balanceEntry = new BalanceSheet(id);
    balanceEntry.account = event.params._to.toHexString();
    balanceEntry.setToken = event.params._setToken.toHexString();
    balanceEntry.balance = event.params._quantity;
  } else {
    balanceEntry.balance = balanceEntry.balance.plus(event.params._quantity);
  }
  balanceEntry.save();
}

export function handleSetTokenRedeemed(event: SetTokenRedeemed): void {
  checkForTokensAndItsComponents(event.params._setToken);

  let id =
    event.params._redeemer.toHexString() + "-" + event.params._setToken.toHexString();

  let balanceEntry = BalanceSheet.load(id);
  balanceEntry.balance = balanceEntry.balance.minus(event.params._quantity);
  balanceEntry.save();
}

function checkForTokensAndItsComponents(address: Address): void {
  let newSetToken = SetTokenEntity.load(address.toHexString());
  if (!newSetToken) {
    log.debug(`New SetToken Found ${address.toHexString()}`, []);

    newSetToken = new SetTokenEntity(address.toHexString());

    let setTokenInstance = SetTokenContract.bind(address);
    newSetToken.name = setTokenInstance.name();
    newSetToken.symbol = setTokenInstance.symbol();
    newSetToken.decimals = setTokenInstance.decimals();

    let managerResult = setTokenInstance.try_manager();

    if (managerResult.reverted) {
      log.warning(
        `Cannot find manager of set token ${address.toHexString()}`,
        []
      );
      newSetToken.manager = "Manager Not Found";
    } else {
      newSetToken.manager = managerResult.value.toHexString();
    }

    let setTokenComponents: string[] = [];
    let setTokenComponentUnits: BigInt[] = [];

    let components = setTokenInstance.getComponents();

    for (let index = 0; index < components.length; index++) {
      let element = components[index];
      let componentTokenContract = SetTokenContract.bind(element);
      let componentToken = StandardToken.load(element.toHexString());
      if (!componentToken) {
        componentToken = new StandardToken(element.toHexString());
        let nameResult = componentTokenContract.try_name();
        if (nameResult.reverted) {
          log.warning(`Cannot find name of token ${element.toHexString()}`, []);
          componentToken.name = "Name Not Found";
        } else {
          componentToken.name = nameResult.value;
        }
        let symbolResult = componentTokenContract.try_symbol();
        if (symbolResult.reverted) {
          log.warning(
            `Cannot find symbol of token ${element.toHexString()}`,
            []
          );
          componentToken.symbol = "Symbol Not Found";
        } else {
          componentToken.symbol = symbolResult.value;
        }
        componentToken.save();
      }
      setTokenComponents.push(element.toHexString());

      let unit = setTokenInstance.getDefaultPositionRealUnit(element);
      setTokenComponentUnits.push(unit);
    }

    newSetToken.components = setTokenComponents;
    newSetToken.units = setTokenComponentUnits;

    newSetToken.save();
  }
}
