import { SetToken as SetTokenEntity, StandardToken } from "../generated/schema";
import { SetTokenCreated } from "../generated/SetTokenCreator/SetTokenCreator";
import { SetToken as SetTokenContract } from "../generated/SetToken/SetToken";

import { log, BigInt } from "@graphprotocol/graph-ts";

export function handleSetTokenCreated(event: SetTokenCreated): void {
  let newSetToken = SetTokenEntity.load(event.params._setToken.toHexString());
  if (!newSetToken) {
    log.debug(`New SetToken Found ${event.params._setToken.toHexString()}`, []);

    newSetToken = new SetTokenEntity(event.params._setToken.toHexString());
    newSetToken.manager = event.params._manager.toHexString();

    let setTokenInstance = SetTokenContract.bind(event.params._setToken);
    newSetToken.name = setTokenInstance.name();
    newSetToken.symbol = setTokenInstance.symbol();
    newSetToken.decimals = setTokenInstance.decimals();

    let setTokenComponents: string[] = [];
    let setTokenComponentUnits: BigInt[] = [];

    let components = setTokenInstance.getComponents();
    // arrange components
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

      // units
      let unit = setTokenInstance.getDefaultPositionRealUnit(element);
      setTokenComponentUnits.push(unit);
    }

    newSetToken.components = setTokenComponents;
    newSetToken.units = setTokenComponentUnits;

    newSetToken.save();
  }
}
