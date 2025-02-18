import { BackendApplicationContribution } from "@theia/core/lib/node/backend-application";
import { ContainerModule } from "@theia/core/shared/inversify";
import { PLCBackendContribution } from "./plc-backend-contribution";

const backendModule = new ContainerModule((bind) => {
  // Bind the PLC backend contribution
  bind(BackendApplicationContribution)
    .to(PLCBackendContribution)
    .inSingletonScope();
});

export default backendModule;
